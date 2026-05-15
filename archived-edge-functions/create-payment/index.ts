/// <reference path="../deno.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'
import { corsHeaders, jsonResponse, errorResponse, handleOptions } from '../_shared/cors.ts'

const corsHeadersExtended = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key'
}

async function validateReferralCode(supabase: any, code: string, userId: string, price: number) {
  const { data, error } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return { valid: false, error: 'Invalid referral code' };
  if (data.valid_until && new Date(data.valid_until) < new Date()) return { valid: false, error: 'Code expired' };
  if (data.max_uses && data.times_used >= data.max_uses) return { valid: false, error: 'Code fully redeemed' };
  if (data.min_purchase_amount > 0 && price < data.min_purchase_amount) return { valid: false, error: 'Minimum purchase not met' };

  // Check per-user limit
  const { count } = await supabase
    .from('referral_code_uses')
    .select('id', { count: 'exact', head: true })
    .eq('code_id', data.id)
    .eq('user_id', userId);

  if (count !== null && count >= data.max_uses_per_user) return { valid: false, error: 'You have already used this code' };

  const discountAmount = data.discount_type === 'percentage'
    ? Math.floor(price * data.discount_value / 100)
    : Math.min(data.discount_value, price);

  return { valid: true, codeData: data, discountAmount };
}

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Authorization required', 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return errorResponse('Invalid authentication', 401);
    }

    const { userId, contentId, contentType, price, referralCode } = await req.json();

    // Normalize contentType to lowercase for consistent checking
    const normalizedContentType = (contentType || '').toLowerCase().trim();

    if (!userId || !contentId || !normalizedContentType || !price) {
      return errorResponse('Missing required fields: userId, contentId, contentType, price', 400);
    }

    if (userId !== user.id) {
      return errorResponse('User ID mismatch', 403);
    }

    // Validate that only rentable content types are allowed (backend validation)
    const rentableTypes = ['movie', 'season', 'episode'];
    if (!rentableTypes.includes(normalizedContentType)) {
      return errorResponse(
        `Content type "${normalizedContentType}" is not available for rental. Only movies, seasons, and episodes can be rented.`,
        400
      );
    }

    // Validate referral code if provided
    let discountAmount = 0;
    let validatedCode: any = null;
    let finalPrice = price;

    if (referralCode) {
      const result = await validateReferralCode(supabase, referralCode, user.id, price);
      if (!result.valid) {
        return errorResponse(result.error ?? 'Invalid referral code', 400);
      }
      discountAmount = result.discountAmount!;
      validatedCode = result.codeData;
      finalPrice = Math.max(0, price - discountAmount);
    }

    // `price`/`finalPrice` coming into this function is already stored in KOBO (smallest unit).
    // Paystack initialization for this project expects NGN major units (same convention used in wallet-payment).
    const amountInKobo = Math.round(finalPrice);

    // Get user email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', user.id)
      .single();

    if (!profile?.email) {
      return errorResponse('User email not found', 400);
    }

    // Generate unique intent_id for idempotency
    const intentId = crypto.randomUUID();

    // Create payment metadata
    const paymentMetadata: any = {
      content_id: contentId,
      content_type: normalizedContentType,
      original_price: price
    };

    if (validatedCode) {
      paymentMetadata.referral_code = validatedCode.code;
      paymentMetadata.referral_code_id = validatedCode.id;
      paymentMetadata.discount_amount = discountAmount;
      paymentMetadata.discount_type = validatedCode.discount_type;
      paymentMetadata.discount_value = validatedCode.discount_value;
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
        .insert({
          user_id: user.id,
          amount: amountInKobo,
          currency: 'NGN',
          purpose: 'rental',
          intent_id: intentId,
          metadata: paymentMetadata,
          status: 'pending'
        })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment creation error:', paymentError);
      return errorResponse('Failed to create payment record', 500);
    }

    // Initialize Paystack payment
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY') ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: profile.email,
        amount: amountInKobo,
        reference: intentId,
        callback_url: `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/paystack-webhook`,
        metadata: {
          payment_id: payment.id,
          user_id: user.id,
          content_id: contentId,
          content_type: normalizedContentType,
          ...(validatedCode && {
            referral_code_id: validatedCode.id,
            discount_applied: discountAmount
          })
        }
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      console.error('Paystack error:', paystackData);
      return errorResponse('Failed to initialize payment', 500);
    }

    return jsonResponse({
      success: true,
      payment_id: payment.id,
      authorization_url: paystackData.data.authorization_url,
      discount_applied: discountAmount,
      final_amount: amountInKobo
    });

  } catch (error) {
    console.error('Create payment error:', error);
    return errorResponse('Internal server error', 500);
  }
});

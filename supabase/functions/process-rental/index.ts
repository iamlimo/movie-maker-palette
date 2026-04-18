import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const RENTAL_DURATION_HOURS = 48;
const SEASON_RENTAL_DURATION_HOURS = 720; // 30 days

// CORS Headers - explicitly defined to ensure they're always present
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://signaturetv.co',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Content-Type': 'application/json',
};

// Helper function to ensure CORS headers on all responses
function createResponse(data: unknown, status = 200) {
  return new Response(
    JSON.stringify(data),
    { status, headers: corsHeaders }
  );
}

interface ProcessRentalRequest {
  userId: string;
  contentId: string;
  contentType: 'episode' | 'season';
  price: number;
  paymentMethod: 'wallet' | 'paystack';
  referralCode?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('OK', {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: ProcessRentalRequest = await req.json();
    const { userId, contentId, contentType, price, paymentMethod, referralCode } = body;

    // Validate required fields
    if (!userId || !contentId || !contentType || !price || !paymentMethod) {
      return createResponse({ error: 'Missing required fields' }, 400);
    }

    // Check for existing active rental
    const { data: existingRental } = await supabase
      .from('rentals')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .eq('status', 'completed')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingRental) {
      return createResponse({ error: 'User already has active rental for this content' }, 409);
    }

    let finalPrice = price;
    let discountApplied = 0;

    // Apply referral code discount if provided
    if (referralCode) {
      const { data: codeData } = await supabase
        .from('referral_codes')
        .select('id, discount_type, discount_value')
        .eq('code', referralCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (codeData) {
        if (codeData.discount_type === 'percentage') {
          discountApplied = Math.floor(price * codeData.discount_value / 100);
        } else {
          discountApplied = Math.min(codeData.discount_value, price);
        }
        finalPrice = Math.max(0, price - discountApplied);

        // Record referral code usage
        await supabase.from('referral_code_uses').insert({
          code_id: codeData.id,
          user_id: userId,
          rental_id: undefined,
        });
      }
    }

    // Calculate expiration time based on content type
    const expiresAt = new Date();
    const durationHours = contentType === 'season' ? SEASON_RENTAL_DURATION_HOURS : RENTAL_DURATION_HOURS;
    expiresAt.setHours(expiresAt.getHours() + durationHours);

    if (paymentMethod === 'wallet') {
      // Wallet payment - deduct from user's wallet
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();

      if (walletError || !wallet) {
        return createResponse({ error: 'Wallet not found' }, 404);
      }

      if (wallet.balance < finalPrice) {
        return createResponse({ error: 'Insufficient wallet balance' }, 402);
      }

      // Create rental record
      const { data: rental, error: rentalError } = await supabase
        .from('rentals')
        .insert({
          user_id: userId,
          content_id: contentId,
          content_type: contentType,
          price: price,
          discount_applied: discountApplied,
          final_price: finalPrice,
          payment_method: 'wallet',
          status: 'completed',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (rentalError) {
        return createResponse({ error: 'Failed to create rental record' }, 500);
      }

      // Deduct from wallet
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance: wallet.balance - finalPrice })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Wallet update error:', updateError);
        await supabase.from('rentals').delete().eq('id', rental.id);
        return createResponse({ error: 'Failed to process payment' }, 500);
      }

      // Update referral code usage with rental ID
      if (referralCode && discountApplied > 0) {
        const { data: codeData } = await supabase
          .from('referral_codes')
          .select('id')
          .eq('code', referralCode.toUpperCase())
          .maybeSingle();

        if (codeData) {
          await supabase
            .from('referral_code_uses')
            .update({ rental_id: rental.id })
            .eq('user_id', userId)
            .eq('code_id', codeData.id)
            .order('created_at', { ascending: false })
            .limit(1);
        }
      }

      return createResponse({
        success: true,
        rentalId: rental.id,
        paymentMethod: 'wallet',
        discountApplied,
      });
    } else if (paymentMethod === 'paystack') {
      // Paystack payment - create payment record and generate authorization URL
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('email, raw_user_meta_data')
        .eq('id', userId)
        .maybeSingle();

      if (userError || !user) {
        return createResponse({ error: 'User profile not found' }, 404);
      }

      // Create pending rental record
      const { data: rental, error: rentalError } = await supabase
        .from('rentals')
        .insert({
          user_id: userId,
          content_id: contentId,
          content_type: contentType,
          price: price,
          discount_applied: discountApplied,
          final_price: finalPrice,
          payment_method: 'paystack',
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (rentalError) {
        return createResponse({ error: 'Failed to create rental record' }, 500);
      }

      // Get user's full name for Paystack
      const userData = user.raw_user_meta_data as any;
      const fullName = userData?.full_name || user.email?.split('@')[0] || 'Customer';

      // Initialize Paystack payment
      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          amount: finalPrice, // Already in kobo
          metadata: {
            rental_id: rental.id,
            content_id: contentId,
            content_type: contentType,
            discount_code: referralCode || null,
            discount_amount: discountApplied,
            user_name: fullName,
          },
          callback_url: `${SUPABASE_URL}/verify-rental-payment?rental_id=${rental.id}`,
        }),
      });

      if (!paystackResponse.ok) {
        const error = await paystackResponse.json();
        console.error('Paystack error:', error);
        await supabase.from('rentals').delete().eq('id', rental.id);
        return createResponse({ error: 'Failed to initialize payment' }, 500);
      }

      const paystackData = await paystackResponse.json();

      // Create rental_payments tracking record
      const { error: paymentTrackError } = await supabase
        .from('rental_payments')
        .insert({
          rental_id: rental.id,
          user_id: userId,
          paystack_reference: paystackData.data.reference,
          paystack_access_code: paystackData.data.access_code,
          amount: finalPrice,
          payment_status: 'pending',
        });

      if (paymentTrackError) {
        console.error('Payment tracking error:', paymentTrackError);
      }

      return createResponse({
        success: true,
        rentalId: rental.id,
        paymentMethod: 'paystack',
        authorizationUrl: paystackData.data.authorization_url,
        paystackReference: paystackData.data.reference,
        discountApplied,
      });
    }

    return createResponse({ error: 'Invalid payment method' }, 400);
  } catch (error) {
    console.error('Error in process-rental:', error);
    return createResponse({ error: 'Internal server error' }, 500);
  }
});
        await supabase.from('rentals').delete().eq('id', rental.id);

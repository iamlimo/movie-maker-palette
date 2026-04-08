import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { checkRateLimit } from "../_shared/auth.ts";
import { validatePaymentAmount, sanitizeInput } from "../_shared/validation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function validateReferralCode(supabase: any, code: string, userId: string, price: number) {
  const { data, error } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single();

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!checkRateLimit(user.id, 5, 60000)) {
      return new Response(JSON.stringify({ error: 'Too many payment requests. Please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const requestBody = await req.json();
    const sanitized = sanitizeInput(requestBody);
    const { contentId, contentType, price, useWallet, referralCode } = sanitized;

    const amountValidation = validatePaymentAmount(price);
    if (!amountValidation.isValid) {
      return new Response(JSON.stringify({ error: amountValidation.errors[0] }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!contentId || !contentType || !price) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check for existing active rental
    const { data: existingRental } = await supabase
      .from('rentals')
      .select('id, expires_at')
      .eq('user_id', user.id)
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingRental) {
      return new Response(JSON.stringify({ 
        error: 'Active rental exists', 
        expires_at: existingRental.expires_at 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate referral code if provided
    let discountAmount = 0;
    let validatedCode: any = null;
    if (referralCode) {
      const result = await validateReferralCode(supabase, referralCode, user.id, price);
      if (!result.valid) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      discountAmount = result.discountAmount!;
      validatedCode = result.codeData;
    }

    const finalPrice = Math.max(0, price - discountAmount);

    // Get user wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('wallet_id, balance')
      .eq('user_id', user.id)
      .single();

    if (!wallet) {
      return new Response(JSON.stringify({ error: 'Wallet not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const paymentMetadata: any = { 
      content_id: contentId, 
      content_type: contentType,
      original_price: price,
    };
    if (validatedCode) {
      paymentMetadata.referral_code = validatedCode.code;
      paymentMetadata.referral_code_id = validatedCode.id;
      paymentMetadata.discount_amount = discountAmount;
      paymentMetadata.discount_type = validatedCode.discount_type;
      paymentMetadata.discount_value = validatedCode.discount_value;
    }

    // If user wants to pay with wallet
    if (useWallet) {
      if (wallet.balance < finalPrice) {
        return new Response(JSON.stringify({ 
          error: 'Insufficient wallet balance',
          balance: wallet.balance,
          required: finalPrice,
          deficit: finalPrice - wallet.balance
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          amount: finalPrice,
          purpose: 'rental',
          currency: 'NGN',
          provider: 'wallet',
          enhanced_status: 'completed',
          status: 'completed',
          metadata: { ...paymentMetadata, payment_method: 'wallet' }
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Deduct from wallet (only if finalPrice > 0)
      if (finalPrice > 0) {
        const { error: walletError } = await supabase.rpc('process_wallet_transaction', {
          p_wallet_id: wallet.wallet_id,
          p_amount: finalPrice,
          p_type: 'debit',
          p_description: `Rental: ${contentType}${validatedCode ? ` (code: ${validatedCode.code})` : ''}`,
          p_payment_id: payment.id,
          p_metadata: paymentMetadata
        });

        if (walletError) throw walletError;
      }

      // Record referral code usage
      if (validatedCode) {
        await supabase.from('referral_code_uses').insert({
          code_id: validatedCode.id,
          user_id: user.id,
          payment_id: payment.id,
          discount_applied: discountAmount,
        });
        await supabase.from('referral_codes').update({ times_used: validatedCode.times_used + 1 }).eq('id', validatedCode.id);
      }

      // Fetch content-specific rental expiry duration
      let expiryHours = 48;
      
      if (contentType === 'movie') {
        const { data: movieData } = await supabase
          .from('movies')
          .select('rental_expiry_duration')
          .eq('id', contentId)
          .single();
        expiryHours = movieData?.rental_expiry_duration || 48;
      } else if (contentType === 'season') {
        const { data: seasonData } = await supabase
          .from('seasons')
          .select('rental_expiry_duration')
          .eq('id', contentId)
          .single();
        expiryHours = seasonData?.rental_expiry_duration || 336;
      } else if (contentType === 'episode') {
        const { data: episodeData } = await supabase
          .from('episodes')
          .select('rental_expiry_duration')
          .eq('id', contentId)
          .single();
        expiryHours = episodeData?.rental_expiry_duration || 48;
      }

      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

      // Create rental record
      const { error: rentalError } = await supabase
        .from('rentals')
        .insert({
          user_id: user.id,
          content_id: contentId,
          content_type: contentType,
          amount: finalPrice, // in naira
          expires_at: expiresAt,
          status: 'active'
        });

      if (rentalError) throw rentalError;

      return new Response(JSON.stringify({
        success: true,
        payment_method: 'wallet',
        rental_expires_at: expiresAt,
        discount_applied: discountAmount > 0 ? discountAmount : undefined,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fallback to Paystack
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', user.id)
      .single();

    const intentId = crypto.randomUUID();

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        amount: finalPrice * 100, // in kobo
        purpose: 'rental',
        currency: 'NGN',
        provider: 'paystack',
        enhanced_status: 'initiated',
        intent_id: intentId,
        metadata: paymentMetadata
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: profile?.email || user.email,
        amount: finalPrice * 100, // in kobo
        reference: payment.intent_id,
        callback_url: `${req.headers.get('origin') || 'https://movie-maker-palette.lovable.app'}/${contentType}/${contentId}?payment=success`,
        metadata: {
          payment_id: payment.id,
          user_id: user.id,
          content_id: contentId,
          content_type: contentType,
          purpose: 'rental',
          ...(validatedCode ? {
            referral_code_id: validatedCode.id,
            referral_code: validatedCode.code,
            discount_amount: discountAmount,
          } : {})
        }
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      throw new Error(paystackData.message || 'Paystack initialization failed');
    }

    await supabase
      .from('payments')
      .update({ 
        provider_reference: paystackData.data.reference,
        enhanced_status: 'pending' 
      })
      .eq('id', payment.id);

    return new Response(JSON.stringify({
      success: true,
      payment_method: 'paystack',
      payment_id: payment.id,
      authorization_url: paystackData.data.authorization_url
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Wallet payment error:', error);
    return new Response(JSON.stringify({ error: 'An error occurred processing your payment' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

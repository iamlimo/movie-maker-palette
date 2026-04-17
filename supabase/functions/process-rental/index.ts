import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { corsHeaders } from "../_shared/cors.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
const RENTAL_DURATION_HOURS = 48; // Default rental duration

interface ProcessRentalRequest {
  userId: string;
  contentId: string;
  contentType: 'episode' | 'season';
  price: number;
  paymentMethod: 'wallet' | 'paystack';
  referralCode?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: ProcessRentalRequest = await req.json();
    const { userId, contentId, contentType, price, paymentMethod, referralCode } = body;

    // Validate required fields
    if (!userId || !contentId || !contentType || !price || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: 'User already has active rental for this content' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
          rental_id: undefined, // Will be set after rental creation
        });
      }
    }

    // Calculate expiration time based on content type
    const expiresAt = new Date();
    if (contentType === 'season') {
      // Season rentals don't expire (or expire after a long time)
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      // Episode rentals expire after RENTAL_DURATION_HOURS
      expiresAt.setHours(expiresAt.getHours() + RENTAL_DURATION_HOURS);
    }

    if (paymentMethod === 'wallet') {
      // Wallet payment - deduct from user's wallet
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();

      if (walletError || !wallet) {
        return new Response(
          JSON.stringify({ error: 'Wallet not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (wallet.balance < finalPrice) {
        return new Response(
          JSON.stringify({ error: 'Insufficient wallet balance' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
        return new Response(
          JSON.stringify({ error: 'Failed to create rental record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Deduct from wallet
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance: wallet.balance - finalPrice })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Wallet update error:', updateError);
        // Delete rental if wallet update fails
        await supabase.from('rentals').delete().eq('id', rental.id);
        return new Response(
          JSON.stringify({ error: 'Failed to process payment' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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

      return new Response(
        JSON.stringify({
          success: true,
          rentalId: rental.id,
          paymentMethod: 'wallet',
          discountApplied,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (paymentMethod === 'paystack') {
      // Paystack payment - create payment record and generate authorization URL
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'User profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
        return new Response(
          JSON.stringify({ error: 'Failed to create rental record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
          },
          callback_url: `${Deno.env.get('SUPABASE_URL')}/rental-callback`,
        }),
      });

      if (!paystackResponse.ok) {
        const error = await paystackResponse.json();
        console.error('Paystack error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to initialize payment' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const paystackData = await paystackResponse.json();

      return new Response(
        JSON.stringify({
          success: true,
          rentalId: rental.id,
          paymentMethod: 'paystack',
          authorizationUrl: paystackData.data.authorization_url,
          discountApplied,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid payment method' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in process-rental:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { contentId, contentType, price, useWallet } = await req.json();

    if (!contentId || !contentType || !price) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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

    // If user wants to pay with wallet
    if (useWallet) {
      if (wallet.balance < price) {
        return new Response(JSON.stringify({ 
          error: 'Insufficient wallet balance',
          balance: wallet.balance,
          required: price,
          deficit: price - wallet.balance
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
          amount: price,
          purpose: 'rental',
          currency: 'NGN',
          provider: 'wallet',
          enhanced_status: 'completed',
          status: 'completed',
          metadata: { 
            content_id: contentId, 
            content_type: contentType,
            payment_method: 'wallet'
          }
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Deduct from wallet
      const { error: walletError } = await supabase.rpc('process_wallet_transaction', {
        p_wallet_id: wallet.wallet_id,
        p_amount: price,
        p_type: 'debit',
        p_description: `Rental: ${contentType}`,
        p_payment_id: payment.id,
        p_metadata: { content_id: contentId, content_type: contentType }
      });

      if (walletError) throw walletError;

      // Calculate expiration based on content type
      const hoursToAdd = contentType === 'season' ? 336 : 48; // 14 days or 48 hours
      const expiresAt = new Date(Date.now() + hoursToAdd * 60 * 60 * 1000).toISOString();

      // Create rental record
      const { error: rentalError } = await supabase
        .from('rentals')
        .insert({
          user_id: user.id,
          content_id: contentId,
          content_type: contentType,
          amount: price,
          expires_at: expiresAt,
          status: 'active'
        });

      if (rentalError) throw rentalError;

      return new Response(JSON.stringify({
        success: true,
        payment_method: 'wallet',
        rental_expires_at: expiresAt
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
        amount: price,
        purpose: 'rental',
        currency: 'NGN',
        provider: 'paystack',
        enhanced_status: 'initiated',
        intent_id: intentId,
        metadata: { content_id: contentId, content_type: contentType }
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
        amount: price,
        reference: payment.intent_id,
        callback_url: `${new URL(req.url).origin}/${contentType}/${contentId}?payment=success`,
        metadata: {
          payment_id: payment.id,
          user_id: user.id,
          content_id: contentId,
          content_type: contentType,
          purpose: 'rental'
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

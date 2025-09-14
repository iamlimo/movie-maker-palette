import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

interface PaymentIntentRequest {
  amount: number;
  currency?: string;
  purpose: 'wallet_topup' | 'rental' | 'purchase' | 'subscription';
  metadata?: any;
  email: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const idempotencyKey = req.headers.get('idempotency-key');
    if (!idempotencyKey) {
      throw new Error('Idempotency-Key header is required');
    }

    const body: PaymentIntentRequest = await req.json();
    const { amount, currency = 'NGN', purpose, metadata = {}, email } = body;

    // Validate amount (minimum 100 kobo = 1 NGN)
    if (!amount || amount < 100) {
      throw new Error('Amount must be at least 100 kobo (1 NGN)');
    }

    // Check if payment intent already exists (idempotency)
    const { data: existingPayment } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('intent_id', idempotencyKey)
      .single();

    if (existingPayment) {
      // Return existing payment intent
      const paystackResponse = {
        authorization_url: `https://checkout.paystack.com/v1/transaction/${existingPayment.provider_reference}`,
        access_code: existingPayment.provider_reference,
        reference: existingPayment.provider_reference
      };

      return new Response(JSON.stringify({
        success: true,
        payment_id: existingPayment.id,
        paystack: paystackResponse
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create payment record first
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .insert({
        user_id: user.id,
        amount: amount / 100, // Convert kobo to naira for storage
        currency,
        purpose,
        metadata,
        provider: 'paystack',
        intent_id: idempotencyKey,
        enhanced_status: 'initiated',
        transaction_type: purpose === 'wallet_topup' ? 'credit' : 'debit'
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment creation error:', paymentError);
      throw new Error('Failed to create payment record');
    }

    // Initialize Paystack transaction
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured');
    }

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount, // Amount in kobo
        currency,
        reference: payment.id, // Use our payment ID as reference
        callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/paystack-webhook`,
        metadata: {
          ...metadata,
          payment_id: payment.id,
          user_id: user.id,
          purpose
        }
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      console.error('Paystack initialization error:', paystackData);
      
      // Update payment status to failed
      await supabaseClient
        .from('payments')
        .update({ 
          enhanced_status: 'failed',
          error_message: paystackData.message || 'Paystack initialization failed'
        })
        .eq('id', payment.id);

      throw new Error(paystackData.message || 'Failed to initialize Paystack transaction');
    }

    // Update payment with Paystack reference
    await supabaseClient
      .from('payments')
      .update({ 
        provider_reference: paystackData.data.reference,
        enhanced_status: 'pending'
      })
      .eq('id', payment.id);

    // Log finance action
    await supabaseClient
      .rpc('log_finance_action', {
        p_action: 'payment_intent_created',
        p_details: {
          payment_id: payment.id,
          amount: amount,
          currency,
          purpose,
          paystack_reference: paystackData.data.reference
        }
      });

    return new Response(JSON.stringify({
      success: true,
      payment_id: payment.id,
      paystack: paystackData.data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in create-payment-intent:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
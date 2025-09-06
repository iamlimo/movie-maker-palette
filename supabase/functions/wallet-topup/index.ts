import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

interface WalletTopupRequest {
  amount: number;
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

    const body: WalletTopupRequest = await req.json();
    const { amount, email } = body;

    // Validate amount (minimum 100 kobo = 1 NGN)
    if (!amount || amount < 100) {
      throw new Error('Amount must be at least 100 kobo (1 NGN)');
    }

    // Generate idempotency key for wallet topup
    const idempotencyKey = `wallet_topup_${user.id}_${Date.now()}`;

    // Call create-payment-intent function
    const intentResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authHeader}`,
        'Content-Type': 'application/json',
        'idempotency-key': idempotencyKey
      },
      body: JSON.stringify({
        amount,
        purpose: 'wallet_topup',
        email,
        metadata: {
          wallet_topup: true
        }
      })
    });

    const intentData = await intentResponse.json();

    if (!intentData.success) {
      throw new Error(intentData.error || 'Failed to create payment intent');
    }

    return new Response(JSON.stringify({
      success: true,
      payment_id: intentData.payment_id,
      checkout_url: intentData.paystack.authorization_url,
      paystack: intentData.paystack
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in wallet-topup:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
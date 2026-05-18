import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { checkRateLimit } from "../_shared/auth.ts";
import { validatePaymentAmount } from "../_shared/validation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ORIGINS = new Set([
  'https://signaturetv.co',
  'https://www.signaturetv.co',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
]);

function getFrontendOrigin(req: Request) {
  const origin = req.headers.get('origin') || '';

  if (ALLOWED_ORIGINS.has(origin)) return origin;
  if (origin.startsWith('https://') && origin.includes('.vercel.app')) return origin;

  return 'https://signaturetv.co';
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

    // Rate limiting: 10 requests per minute per user
    if (!checkRateLimit(user.id, 10, 60000)) {
      return new Response(JSON.stringify({ error: 'Too many funding requests. Please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { amount } = await req.json();

    // Validate amount using shared validation utility
    const amountValidation = validatePaymentAmount(amount);
    if (!amountValidation.isValid) {
      return new Response(JSON.stringify({ error: amountValidation.errors[0] }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user profile for email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', user.id)
      .single();

    const intentId = crypto.randomUUID();

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        amount: amount,
        purpose: 'wallet_topup',
        currency: 'NGN',
        provider: 'paystack',
        enhanced_status: 'initiated',
        intent_id: intentId,
        metadata: { source: 'wallet_funding' }
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Initialize Paystack
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: profile?.email || user.email,
        amount: amount,
        reference: payment.intent_id,
        callback_url:
          `${getFrontendOrigin(req)}/payment/callback` +
          `?kind=wallet&paymentId=${encodeURIComponent(payment.id)}` +
          `&returnTo=${encodeURIComponent('/wallet')}`,
        metadata: {
          payment_id: payment.id,
          user_id: user.id,
          purpose: 'wallet_topup'
        }
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      throw new Error(paystackData.message || 'Paystack initialization failed');
    }

    // Update payment with provider reference
    await supabase
      .from('payments')
      .update({ 
        provider_reference: paystackData.data.reference,
        enhanced_status: 'pending' 
      })
      .eq('id', payment.id);

    return new Response(JSON.stringify({
      success: true,
      payment_id: payment.id,
      authorization_url: paystackData.data.authorization_url,
      reference: paystackData.data.reference
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Wallet funding error:', error);
    return new Response(JSON.stringify({ error: 'An error occurred processing your request' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

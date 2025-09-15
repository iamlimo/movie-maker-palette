import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'
import { corsHeaders, jsonResponse, errorResponse, handleOptions } from '../_shared/cors.ts'

const corsHeadersExtended = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key'
}

Deno.serve(async (req) => {
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

    const { userId, contentId, contentType, price } = await req.json();

    if (!userId || !contentId || !contentType || !price) {
      return errorResponse('Missing required fields: userId, contentId, contentType, price', 400);
    }

    if (userId !== user.id) {
      return errorResponse('User ID mismatch', 403);
    }

    // Convert price to kobo for Paystack
    const amountInKobo = Math.round(price * 100);

    // Get user email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', user.id)
      .single();

    if (!profile?.email) {
      return errorResponse('User email not found', 400);
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        amount: amountInKobo,
        currency: 'NGN',
        purpose: 'rental',
        metadata: {
          content_id: contentId,
          content_type: contentType
        },
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
        'Authorization': `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: profile.email,
        amount: amountInKobo,
        reference: payment.id,
        metadata: {
          payment_id: payment.id,
          user_id: user.id,
          content_id: contentId,
          content_type: contentType
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
      authorization_url: paystackData.data.authorization_url
    });

  } catch (error) {
    console.error('Create payment error:', error);
    return errorResponse('Internal server error', 500);
  }
});
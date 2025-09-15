import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

async function verifyPaystackSignature(payload: string, signature: string): Promise<boolean> {
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret) {
    console.error('Paystack secret key not found');
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSignature === signature;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing Paystack signature' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const body = await req.text();
    
    // Verify webhook signature
    const isValid = await verifyPaystackSignature(body, signature);
    if (!isValid) {
      console.error('Invalid Paystack signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const event = JSON.parse(body);
    console.log('Webhook event:', event.event, event.data?.reference);

    // Handle charge.success event
    if (event.event === 'charge.success') {
      const { data } = event;
      const paymentId = data.reference;

      // Check if already processed to prevent duplicates
      const { data: existingRental } = await supabase
        .from('rentals')
        .select('id')
        .eq('user_id', data.metadata.user_id)
        .eq('content_id', data.metadata.content_id)
        .eq('content_type', data.metadata.content_type)
        .eq('amount', data.amount / 100) // Convert back from kobo
        .single();

      if (existingRental) {
        console.log('Rental already exists, skipping');
        return new Response(JSON.stringify({ received: true, message: 'Already processed' }), {
          headers: corsHeaders
        });
      }

      // Update payment status
      const { error: paymentUpdateError } = await supabase
        .from('payments')
        .update({ 
          status: 'success',
          enhanced_status: 'completed'
        })
        .eq('id', paymentId);

      if (paymentUpdateError) {
        console.error('Payment update error:', paymentUpdateError);
      }

      // Create rental record - 48 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      const { error: rentalError } = await supabase
        .from('rentals')
        .insert({
          user_id: data.metadata.user_id,
          content_id: data.metadata.content_id,
          content_type: data.metadata.content_type,
          amount: data.amount / 100, // Convert from kobo to naira
          status: 'active',
          expires_at: expiresAt.toISOString()
        });

      if (rentalError) {
        console.error('Rental creation error:', rentalError);
        return new Response(JSON.stringify({ error: 'Failed to create rental' }), {
          status: 500,
          headers: corsHeaders
        });
      }

      console.log('Rental created successfully for payment:', paymentId);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
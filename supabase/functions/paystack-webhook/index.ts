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
      const paymentReference = data.reference;

      // Find payment by intent_id (reference sent to Paystack is the intent_id)
      const { data: payment, error: paymentLookupError } = await supabase
        .from('payments')
        .select('*')
        .eq('intent_id', paymentReference)
        .single();

      if (paymentLookupError || !payment) {
        console.error('Payment not found for reference:', paymentReference);
        return new Response(JSON.stringify({ received: true, message: 'Payment not found' }), {
          headers: corsHeaders
        });
      }

      // Check if already processed
      if (payment.enhanced_status === 'completed') {
        console.log('Payment already completed, skipping');
        return new Response(JSON.stringify({ received: true, message: 'Already processed' }), {
          headers: corsHeaders
        });
      }

      // Update payment status
      const { error: paymentUpdateError } = await supabase
        .from('payments')
        .update({ 
          status: 'completed',
          enhanced_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);

      if (paymentUpdateError) {
        console.error('Payment update error:', paymentUpdateError);
      }

      // Process based on purpose
      if (payment.purpose === 'rental') {
        const metadata = payment.metadata as any;
        
        // Fetch content-specific rental duration
        let expiryHours = 48;
        const contentType = metadata?.content_type;
        const contentId = metadata?.content_id;

        if (contentType === 'movie') {
          const { data: movieData } = await supabase.from('movies').select('rental_expiry_duration').eq('id', contentId).maybeSingle();
          expiryHours = movieData?.rental_expiry_duration || 48;
        } else if (contentType === 'tv') {
          const { data: tvData } = await supabase.from('tv_shows').select('rental_expiry_duration').eq('id', contentId).maybeSingle();
          expiryHours = tvData?.rental_expiry_duration || 336;
        } else if (contentType === 'season') {
          const { data: seasonData } = await supabase.from('seasons').select('rental_expiry_duration').eq('id', contentId).maybeSingle();
          expiryHours = seasonData?.rental_expiry_duration || 336;
        } else if (contentType === 'episode') {
          const { data: episodeData } = await supabase.from('episodes').select('rental_expiry_duration').eq('id', contentId).maybeSingle();
          expiryHours = episodeData?.rental_expiry_duration || 48;
        }

        const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

        const { error: rentalError } = await supabase
          .from('rentals')
          .insert({
            user_id: payment.user_id,
            content_id: contentId,
            content_type: contentType,
            amount: payment.amount / 100, // Convert from kobo to naira
            status: 'active',
            expires_at: expiresAt
          });

        if (rentalError) {
          console.error('Rental creation error:', rentalError);
        } else {
          console.log('Rental created successfully for payment:', payment.id);
        }
      } else if (payment.purpose === 'wallet_topup') {
        // Credit wallet with the payment amount (in kobo)
        const { data: wallet } = await supabase
          .from('wallets')
          .select('wallet_id')
          .eq('user_id', payment.user_id)
          .single();

        if (wallet) {
          await supabase.rpc('process_wallet_transaction', {
            p_wallet_id: wallet.wallet_id,
            p_amount: payment.amount,
            p_type: 'credit',
            p_description: 'Wallet top-up via Paystack',
            p_payment_id: payment.id,
            p_metadata: { source: 'paystack_webhook' }
          });
          console.log('Wallet topped up for payment:', payment.id);
        }
      }
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
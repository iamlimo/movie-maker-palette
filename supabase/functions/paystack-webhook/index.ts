import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

async function verifyPaystackSignature(payload: string, signature: string): Promise<boolean> {
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret) {
    throw new Error('Paystack secret key not configured');
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computedSignature = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === computedSignature;
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

    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      console.error('No Paystack signature header');
      return new Response('Unauthorized', { status: 401 });
    }

    const payload = await req.text();
    const isValidSignature = await verifyPaystackSignature(payload, signature);

    if (!isValidSignature) {
      console.error('Invalid Paystack signature');
      return new Response('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(payload);
    console.log('Paystack webhook event:', event.event, event.data?.reference);

    // Check if webhook already processed (prevent replay attacks)
    const { data: existingEvent } = await supabaseClient
      .from('webhook_events')
      .select('event_id')
      .eq('provider', 'paystack')
      .eq('provider_event_id', event.data?.reference || event.event)
      .single();

    if (existingEvent) {
      console.log('Webhook already processed:', event.data?.reference);
      return new Response('OK', { status: 200 });
    }

    // Record webhook event
    await supabaseClient
      .from('webhook_events')
      .insert({
        provider: 'paystack',
        provider_event_id: event.data?.reference || event.event,
        event_type: event.event,
        payload: event
      });

    // Handle different event types
    if (event.event === 'charge.success') {
      await handleChargeSuccess(supabaseClient, event.data);
    } else if (event.event === 'charge.failed') {
      await handleChargeFailed(supabaseClient, event.data);
    }

    return new Response('OK', { status: 200 });

  } catch (error: any) {
    console.error('Error in paystack-webhook:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});

async function handleChargeSuccess(supabaseClient: any, data: any) {
  try {
    // Verify transaction with Paystack API (server-side verification)
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${data.reference}`, {
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
      },
    });

    const verifyData = await verifyResponse.json();
    
    if (!verifyData.status || verifyData.data.status !== 'success') {
      console.error('Transaction verification failed:', verifyData);
      return;
    }

    // Find payment by reference (which is our payment ID)
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('id', data.reference)
      .single();

    if (paymentError || !payment) {
      console.error('Payment not found:', data.reference);
      return;
    }

    // Prevent double processing
    if (payment.enhanced_status === 'success') {
      console.log('Payment already processed:', payment.id);
      return;
    }

    // Update payment status
    await supabaseClient
      .from('payments')
      .update({
        enhanced_status: 'success',
        provider_reference: data.reference,
        metadata: {
          ...payment.metadata,
          paystack_response: data
        }
      })
      .eq('id', payment.id);

    // Process based on payment purpose
    if (payment.purpose === 'wallet_topup') {
      await processWalletTopup(supabaseClient, payment, data);
    } else if (payment.purpose === 'rental') {
      await processRental(supabaseClient, payment, data);
    } else if (payment.purpose === 'purchase') {
      await processPurchase(supabaseClient, payment, data);
    }

    // Create ledger entries for revenue split
    await createLedgerEntries(supabaseClient, payment, data);

    // Log successful payment
    await supabaseClient
      .rpc('log_finance_action', {
        p_action: 'payment_completed',
        p_details: {
          payment_id: payment.id,
          amount: data.amount,
          purpose: payment.purpose,
          paystack_reference: data.reference
        }
      });

    console.log('Payment processed successfully:', payment.id);

  } catch (error) {
    console.error('Error handling charge success:', error);
  }
}

async function handleChargeFailed(supabaseClient: any, data: any) {
  try {
    const { error } = await supabaseClient
      .from('payments')
      .update({
        enhanced_status: 'failed',
        error_message: data.gateway_response || 'Payment failed'
      })
      .eq('id', data.reference);

    if (error) {
      console.error('Error updating failed payment:', error);
    }

    // Log failed payment
    await supabaseClient
      .rpc('log_finance_action', {
        p_action: 'payment_failed',
        p_details: {
          payment_id: data.reference,
          error: data.gateway_response,
          paystack_reference: data.reference
        }
      });

  } catch (error) {
    console.error('Error handling charge failed:', error);
  }
}

async function processWalletTopup(supabaseClient: any, payment: any, data: any) {
  // Credit user wallet
  const { error } = await supabaseClient
    .from('wallets')
    .upsert({
      user_id: payment.user_id,
      balance: supabaseClient.sql`balance + ${payment.amount}`
    });

  if (error) {
    console.error('Error updating wallet balance:', error);
    throw error;
  }
}

async function processRental(supabaseClient: any, payment: any, data: any) {
  // Create rental record
  const metadata = payment.metadata;
  const expirationDate = new Date();
  expirationDate.setHours(expirationDate.getHours() + (metadata.rental_duration || 48));

  await supabaseClient
    .from('rentals')
    .insert({
      user_id: payment.user_id,
      content_id: metadata.content_id,
      content_type: metadata.content_type,
      price_paid: payment.amount,
      expiration_date: expirationDate.toISOString(),
      status: 'active'
    });
}

async function processPurchase(supabaseClient: any, payment: any, data: any) {
  // Create purchase record
  const metadata = payment.metadata;
  
  await supabaseClient
    .from('purchases')
    .insert({
      user_id: payment.user_id,
      content_id: metadata.content_id,
      content_type: metadata.content_type,
      price_paid: payment.amount
    });
}

async function createLedgerEntries(supabaseClient: any, payment: any, data: any) {
  const platformCommission = 0.30; // 30% platform fee
  const producerShare = 1 - platformCommission;
  
  const platformAmount = payment.amount * platformCommission;
  const producerAmount = payment.amount * producerShare;

  // Platform entry
  await supabaseClient
    .from('transactions_ledger')
    .insert({
      payment_id: payment.id,
      user_id: payment.user_id,
      amount: platformAmount,
      party: 'platform',
      description: `Platform commission for ${payment.purpose}`
    });

  // Producer entry (if applicable)
  if (payment.metadata?.producer_id) {
    await supabaseClient
      .from('transactions_ledger')
      .insert({
        payment_id: payment.id,
        user_id: payment.user_id,
        amount: producerAmount,
        party: 'producer',
        party_id: payment.metadata.producer_id,
        description: `Producer revenue for ${payment.purpose}`
      });

    // Create payout entry for producer
    await supabaseClient
      .from('payouts')
      .insert({
        producer_id: payment.metadata.producer_id,
        amount: producerAmount,
        status: 'queued',
        metadata: {
          payment_id: payment.id,
          content_id: payment.metadata.content_id
        }
      });
  }
}
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
    console.log('Webhook event:', event.event, 'Reference:', event.data?.reference);

    // Handle charge.success event (covers card, bank transfer, ussd, etc.)
    if (event.event === 'charge.success') {
      const { data } = event;
      const paymentReference = data.reference;
      const paymentChannel = data.channel || 'unknown'; // 'card', 'bank_transfer', 'ussd', 'bank', etc.
      const paymentStatus = data.status; // 'success'
      const paidAmount = data.amount; // Amount in kobo

      console.log(`Processing payment: channel=${paymentChannel}, reference=${paymentReference}, amount=${paidAmount}`);

      // Find rental_payment by paystack reference
      const { data: rentalPayment, error: paymentLookupError } = await supabase
        .from('rental_payments')
        .select('*, rental:rental_id(*)')
        .eq('paystack_reference', paymentReference)
        .maybeSingle();

      if (paymentLookupError || !rentalPayment) {
        console.error('Rental payment not found for reference:', paymentReference);
        // Try finding by reference in rentals metadata
        return new Response(JSON.stringify({ received: true, message: 'Payment processed' }), {
          headers: corsHeaders
        });
      }

      // Check if already processed
      if (rentalPayment.payment_status === 'completed') {
        console.log('Payment already completed, skipping');
        return new Response(JSON.stringify({ received: true, message: 'Already processed' }), {
          headers: corsHeaders
        });
      }

      // Verify amount matches (accounting for fees)
      const expectedAmount = rentalPayment.amount;
      if (paidAmount < expectedAmount) {
        console.warn(`Amount mismatch: received ${paidAmount}, expected ${expectedAmount}`);
        // Update payment status to investigate
        await supabase
          .from('rental_payments')
          .update({
            payment_status: 'amount_mismatch',
            completed_at: new Date().toISOString()
          })
          .eq('id', rentalPayment.id);
        return new Response(JSON.stringify({ received: true, message: 'Amount mismatch' }), {
          headers: corsHeaders
        });
      }

      // Update payment status
      const { error: paymentUpdateError } = await supabase
        .from('rental_payments')
        .update({ 
          payment_status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', rentalPayment.id);

      if (paymentUpdateError) {
        console.error('Payment update error:', paymentUpdateError);
      }

      // Update rental status from pending to completed
      const { error: rentalUpdateError } = await supabase
        .from('rentals')
        .update({
          status: 'completed'
        })
        .eq('id', rentalPayment.rental_id);

      if (rentalUpdateError) {
        console.error('Rental update error:', rentalUpdateError);
        return new Response(JSON.stringify({ 
          received: true, 
          message: 'Payment confirmed but rental update failed' 
        }), {
          headers: corsHeaders
        });
      }

      console.log(`✅ Rental confirmed: rental_id=${rentalPayment.rental_id}, channel=${paymentChannel}`);

      // Log payment success with channel info
      await supabase
        .from('rental_payments')
        .update({
          payment_channel: paymentChannel,
          metadata: {
            paystack_status: paymentStatus,
            channel: paymentChannel,
            amount_paid: paidAmount,
            fees_charged: paidAmount - expectedAmount > 0 ? paidAmount - expectedAmount : 0
          }
        })
        .eq('id', rentalPayment.id);

      return new Response(JSON.stringify({ 
        received: true, 
        message: 'Rental activated',
        rental_id: rentalPayment.rental_id,
        channel: paymentChannel
      }), {
        headers: corsHeaders
      });
    }
    
    // Handle transfer.failed event (bank transfer reversals or failures)
    else if (event.event === 'transfer.failed') {
      console.log('Transfer failed event:', event.data?.reference);
      
      const { data } = event;
      const transferReference = data.reference;
      
      // This is typically for transfers OUT, not relevant for payment received
      // But log it for investigation
      return new Response(JSON.stringify({ received: true }), {
        headers: corsHeaders
      });
    }
    
    // Handle transfer.reversed event
    else if (event.event === 'transfer.reversed') {
      console.log('Transfer reversed event:', event.data?.reference);
      
      const { data } = event;
      const transferReference = data.reference;
      
      // This is typically for transfers OUT, not relevant for payment received
      return new Response(JSON.stringify({ received: true }), {
        headers: corsHeaders
      });
    }
    
    // Handle charge.dispute event (chargeback/dispute)
    else if (event.event === 'charge.dispute.create') {
      console.warn('Charge dispute created:', event.data?.reference);
      
      const { data } = event;
      const paymentReference = data.reference;
      
      const { data: rentalPayment } = await supabase
        .from('rental_payments')
        .select('*')
        .eq('paystack_reference', paymentReference)
        .maybeSingle();
        
      if (rentalPayment) {
        // Mark as disputed
        await supabase
          .from('rental_payments')
          .update({
            payment_status: 'disputed',
            metadata: {
              dispute_reason: event.data?.reason,
              dispute_amount: event.data?.amount
            }
          })
          .eq('id', rentalPayment.id);
      }
      
      return new Response(JSON.stringify({ received: true }), {
        headers: corsHeaders
      });
    }

    // Handle charge.failed event
    else if (event.event === 'charge.failed') {
      console.warn('Charge failed event:', event.data?.reference);
      
      const { data } = event;
      const paymentReference = data.reference;
      
      const { data: rentalPayment } = await supabase
        .from('rental_payments')
        .select('*')
        .eq('paystack_reference', paymentReference)
        .maybeSingle();
        
      if (rentalPayment && rentalPayment.payment_status === 'pending') {
        // Update to failed
        await supabase
          .from('rental_payments')
          .update({
            payment_status: 'failed',
            metadata: {
              failure_reason: event.data?.failure_reason || 'Unknown',
              failure_message: event.data?.failure_message || ''
            }
          })
          .eq('id', rentalPayment.id);
          
        // Mark rental as cancelled
        await supabase
          .from('rentals')
          .update({ status: 'cancelled' })
          .eq('id', rentalPayment.rental_id);
      }
      
      return new Response(JSON.stringify({ received: true }), {
        headers: corsHeaders
      });
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
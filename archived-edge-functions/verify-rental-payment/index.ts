import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { corsHeaders } from "../_shared/cors.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') || '';

interface VerifyRentalPaymentRequest {
  rentalId: string;
  reference?: string; // Paystack reference
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

    // Parse request - can be GET or POST
    let body: VerifyRentalPaymentRequest = { rentalId: '' };
    
    if (req.method === 'POST') {
      body = await req.json();
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      body.rentalId = url.searchParams.get('rental_id') || url.searchParams.get('rentalId') || '';
      body.reference = url.searchParams.get('reference') || '';
    }

    const { rentalId, reference } = body;

    if (!rentalId) {
      return new Response(
        JSON.stringify({ error: 'Missing rental ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch rental and payment info
    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .select(`
        *,
        rental_payments (
          id,
          paystack_reference,
          payment_status,
          amount,
          created_at,
          completed_at
        )
      `)
      .eq('id', rentalId)
      .maybeSingle();

    if (rentalError || !rental) {
      return new Response(
        JSON.stringify({ error: 'Rental not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If rental is already completed, return success
    if (rental.status === 'completed') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'completed',
          rental: {
            id: rental.id,
            status: rental.status,
            expiresAt: rental.expires_at,
          },
          message: 'Rental is active'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If rental is pending and has a Paystack payment, check status
    if (rental.status === 'pending' && rental.rental_payments && rental.rental_payments.length > 0) {
      const payment = rental.rental_payments[0];
      const paystackReference = reference || payment.paystack_reference;

      if (!paystackReference) {
        return new Response(
          JSON.stringify({
            success: false,
            status: 'pending',
            message: 'Payment pending - no reference found'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Query Paystack to verify payment status
      const paystackVerifyResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${paystackReference}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!paystackVerifyResponse.ok) {
        console.error('Paystack verification failed');
        return new Response(
          JSON.stringify({
            success: false,
            status: 'pending',
            message: 'Unable to verify payment status'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const paystackData = await paystackVerifyResponse.json();
      const paymentData = paystackData.data;

      console.log(`Payment verification: reference=${paystackReference}, status=${paymentData.status}, channel=${paymentData.channel}`);

      // Handle different payment statuses
      if (paymentData.status === 'success') {
        // Payment successful - update rental and payment
        const { error: rentalUpdateError } = await supabase
          .from('rentals')
          .update({ status: 'completed' })
          .eq('id', rentalId);

        const { error: paymentUpdateError } = await supabase
          .from('rental_payments')
          .update({
            payment_status: 'completed',
            completed_at: new Date().toISOString(),
            payment_channel: paymentData.channel,
            metadata: {
              channel: paymentData.channel,
              amount_paid: paymentData.amount,
              paid_at: paymentData.paid_at,
              authorization: paymentData.authorization?.last4 || paymentData.authorization?.bin || 'N/A'
            }
          })
          .eq('paystack_reference', paystackReference);

        if (rentalUpdateError || paymentUpdateError) {
          console.error('Update error:', rentalUpdateError || paymentUpdateError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            status: 'completed',
            rental: {
              id: rental.id,
              status: 'completed',
              expiresAt: rental.expires_at,
            },
            payment: {
              channel: paymentData.channel,
              status: 'success'
            },
            message: `Payment successful via ${paymentData.channel}`
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (paymentData.status === 'pending') {
        // Payment still pending (e.g., bank transfer in progress)
        return new Response(
          JSON.stringify({
            success: false,
            status: 'pending',
            payment: {
              channel: paymentData.channel || 'unknown',
              status: 'pending',
              message: 'Payment is being processed. Bank transfers may take a few minutes.'
            },
            message: `Payment pending (${paymentData.channel}). Please wait or check back shortly.`
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (paymentData.status === 'cancelled' || paymentData.status === 'failed') {
        // Payment failed or cancelled
        const { error: rentalUpdateError } = await supabase
          .from('rentals')
          .update({ status: 'cancelled' })
          .eq('id', rentalId);

        const { error: paymentUpdateError } = await supabase
          .from('rental_payments')
          .update({
            payment_status: 'failed',
            payment_channel: paymentData.channel
          })
          .eq('paystack_reference', paystackReference);

        return new Response(
          JSON.stringify({
            success: false,
            status: 'failed',
            payment: {
              channel: paymentData.channel,
              status: paymentData.status,
              gatewayResponse: paymentData.gateway_response || 'Payment failed'
            },
            message: `Payment ${paymentData.status}. Please try again.`
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          status: paymentData.status,
          message: `Unknown payment status: ${paymentData.status}`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        status: rental.status,
        message: `Rental status: ${rental.status}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error verifying rental payment:', error);
    return new Response(
      JSON.stringify({ error: 'Verification error', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

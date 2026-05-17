import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const PAYSTACK_API_URL = 'https://api.paystack.co';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, rentalPaymentId } = await req.json();
    
    // Validate environment variables
    const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!paystackKey) {
      throw new Error('PAYSTACK_SECRET_KEY environment variable not configured');
    }
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable not configured');
    }
    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let result = {
      synced: 0,
      anomalies_detected: 0,
      errors: [] as string[],
    };

    if (action === 'verify_single' && rentalPaymentId) {
      // Verify a single payment
      const { data: payment, error } = await supabase
        .from('rental_payments')
        .select('*')
        .eq('id', rentalPaymentId)
        .single();

      if (error) throw error;
      if (!payment) throw new Error('Payment not found');

      const transaction = await fetchPaystackTransaction(
        payment.paystack_reference,
        paystackKey
      );
      const anomalies = await detectAnomalies(payment, transaction);

      // Update payment status if Paystack confirms success
      if (
        transaction.status === true &&
        transaction.data.status === 'success' &&
        payment.payment_status !== 'completed'
      ) {
        await supabase
          .from('rental_payments')
          .update({
            payment_status: 'completed',
            metadata: transaction.data,
          })
          .eq('id', rentalPaymentId);

        result.synced = 1;
      }

      // Store any detected anomalies
      if (anomalies.length > 0) {
        await supabase.from('payment_anomalies').insert(
          anomalies.map(anomaly => ({
            rental_payment_id: rentalPaymentId,
            paystack_reference: payment.paystack_reference,
            anomaly_type: anomaly.type,
            severity: anomaly.severity,
            message: anomaly.message,
            paystack_data: transaction.data,
          }))
        );

        result.anomalies_detected = anomalies.length;
      }
    } else if (action === 'sync_all') {
      // Sync all pending payments (max 100 at a time)
      const { data: pendingPayments, error } = await supabase
        .from('rental_payments')
        .select('*')
        .or('payment_status.eq.pending,payment_status.eq.failed')
        .limit(100);

      if (error) throw error;

      for (const payment of pendingPayments) {
        try {
          const transaction = await fetchPaystackTransaction(
            payment.paystack_reference,
            paystackKey
          );
          const anomalies = await detectAnomalies(payment, transaction);

          // Update payment status if Paystack confirms success
          if (
            transaction.status === true &&
            transaction.data.status === 'success' &&
            payment.payment_status !== 'completed'
          ) {
            await supabase
              .from('rental_payments')
              .update({
                payment_status: 'completed',
                metadata: transaction.data,
              })
              .eq('id', payment.id);

            result.synced++;
          }

          // Store detected anomalies
          if (anomalies.length > 0) {
            const insertData = anomalies.map(anomaly => ({
              rental_payment_id: payment.id,
              paystack_reference: payment.paystack_reference,
              anomaly_type: anomaly.type,
              severity: anomaly.severity,
              message: anomaly.message,
              paystack_data: transaction.data,
            }));

            const { error: insertError } = await supabase
              .from('payment_anomalies')
              .insert(insertData);

            if (!insertError) {
              result.anomalies_detected += anomalies.length;
            }
          }
        } catch (error) {
          result.errors.push(
            `Failed to sync payment ${payment.id}: ${error.message}`
          );
        }
      }
    } else {
      throw new Error('Invalid action. Use "verify_single" or "sync_all"');
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        synced: 0,
        anomalies_detected: 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function fetchPaystackTransaction(reference: string, key: string) {
  const response = await fetch(
    `${PAYSTACK_API_URL}/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Paystack API error: ${response.statusText}`);
  }

  return response.json();
}

interface AnomalyDetail {
  type: string;
  severity: 'warning' | 'critical';
  message: string;
}

async function detectAnomalies(
  rentalPayment: any,
  paystackData: any
): Promise<AnomalyDetail[]> {
  const anomalies: AnomalyDetail[] = [];

  if (!paystackData.status || !paystackData.data) {
    return anomalies;
  }

  const transaction = paystackData.data;

  // Check for disputes
  if (transaction.disputes && transaction.disputes.length > 0) {
    anomalies.push({
      type: 'dispute',
      severity: 'critical',
      message: `Payment has ${transaction.disputes.length} dispute(s)`,
    });
  }

  // Check for refunds
  if (transaction.status === 'refunded' || transaction.amount_refunded > 0) {
    anomalies.push({
      type: 'refund',
      severity: 'warning',
      message: `Payment refunded: ₦${(transaction.amount_refunded / 100).toFixed(2)}`,
    });
  }

  // Check for partial payments
  if (transaction.amount_refunded > 0 && transaction.amount > transaction.amount_refunded) {
    anomalies.push({
      type: 'partial_payment',
      severity: 'warning',
      message: `Partial payment: ₦${((transaction.amount - transaction.amount_refunded) / 100).toFixed(2)} retained`,
    });
  }

  // Check for amount mismatch
  if (rentalPayment.amount && transaction.amount !== rentalPayment.amount * 100) {
    anomalies.push({
      type: 'amount_mismatch',
      severity: 'critical',
      message: `Amount mismatch: Expected ₦${(rentalPayment.amount).toFixed(2)}, got ₦${(transaction.amount / 100).toFixed(2)}`,
    });
  }

  // Check for status mismatch
  const rentalStatus = rentalPayment.payment_status;
  const paystackStatus = transaction.status === 'success' ? 'completed' : 'failed';

  if (rentalStatus && rentalStatus !== paystackStatus) {
    anomalies.push({
      type: 'status_mismatch',
      severity: 'warning',
      message: `Status mismatch: DB shows ${rentalStatus}, Paystack shows ${paystackStatus}`,
    });
  }

  return anomalies;
}

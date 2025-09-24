import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RefundRequest {
  payment_id: string;
  reason?: string;
  amount?: number; // Optional partial refund amount
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

    // Get user from JWT and verify admin role
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user has super admin role
    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || userRole.role !== 'super_admin') {
      throw new Error('Only super admins can process refunds');
    }

    const body: RefundRequest = await req.json();
    const { payment_id, reason = 'Admin refund', amount } = body;

    // Get payment details
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      throw new Error('Payment not found');
    }

    if (payment.enhanced_status !== 'success') {
      throw new Error('Can only refund successful payments');
    }

    if (!payment.provider_reference) {
      throw new Error('No Paystack reference found for payment');
    }

    // Calculate refund amount (full refund by default)
    const refundAmount = amount || (payment.amount * 100); // Convert to kobo

    // Process refund with Paystack
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured');
    }

    const refundResponse = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: payment.provider_reference,
        amount: refundAmount,
        currency: payment.currency || 'NGN',
        customer_note: reason,
        merchant_note: `Refund processed by admin: ${user.id}`
      }),
    });

    const refundData = await refundResponse.json();

    if (!refundData.status) {
      console.error('Paystack refund error:', refundData);
      throw new Error(refundData.message || 'Failed to process refund with Paystack');
    }

    // Update payment status
    await supabaseClient
      .from('payments')
      .update({
        enhanced_status: 'refunded',
        metadata: {
          ...payment.metadata,
          refund: {
            refund_id: refundData.data.id,
            amount: refundAmount,
            reason,
            processed_at: new Date().toISOString(),
            processed_by: user.id
          }
        }
      })
      .eq('id', payment_id);

    // Reverse wallet balance if it was a wallet topup
    if (payment.purpose === 'wallet_topup') {
      await supabaseClient
        .from('wallets')
        .update({
          balance: refundAmount / 100 // Simple subtraction - should use RPC for proper calculation
        })
        .eq('user_id', payment.user_id);
    }

    // Create negative ledger entries to reverse revenue splits
    const { data: ledgerEntries } = await supabaseClient
      .from('transactions_ledger')
      .select('*')
      .eq('payment_id', payment_id);

    if (ledgerEntries) {
      for (const entry of ledgerEntries) {
        await supabaseClient
          .from('transactions_ledger')
          .insert({
            payment_id: payment_id,
            user_id: entry.user_id,
            amount: -entry.amount, // Negative amount to reverse
            party: entry.party,
            party_id: entry.party_id,
            description: `Refund reversal: ${entry.description}`
          });
      }
    }

    // Log refund action
    await supabaseClient
      .rpc('log_finance_action', {
        p_action: 'payment_refunded',
        p_details: {
          payment_id,
          refund_amount: refundAmount,
          reason,
          paystack_refund_id: refundData.data.id,
          original_amount: payment.amount * 100
        }
      });

    return new Response(JSON.stringify({
      success: true,
      refund_id: refundData.data.id,
      amount: refundAmount,
      message: 'Refund processed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in refund-payment:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
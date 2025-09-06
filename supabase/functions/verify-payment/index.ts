import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const url = new URL(req.url);
    const paymentId = url.searchParams.get('payment_id');
    const reference = url.searchParams.get('reference');

    if (!paymentId && !reference) {
      throw new Error('Either payment_id or reference is required');
    }

    // Get payment details
    let query = supabaseClient.from('payments').select('*');
    
    if (paymentId) {
      query = query.eq('id', paymentId);
    } else {
      query = query.eq('provider_reference', reference);
    }

    const { data: payment, error: paymentError } = await query.single();

    if (paymentError || !payment) {
      throw new Error('Payment not found');
    }

    // Verify user can access this payment
    if (payment.user_id !== user.id) {
      // Check if user is admin
      const { data: userRole } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!userRole || !['admin', 'super_admin'].includes(userRole.role)) {
        throw new Error('Access denied');
      }
    }

    // If payment has Paystack reference, verify with Paystack
    let paystackStatus = null;
    if (payment.provider_reference && payment.provider === 'paystack') {
      const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
      if (paystackSecretKey) {
        try {
          const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${payment.provider_reference}`, {
            headers: {
              'Authorization': `Bearer ${paystackSecretKey}`,
            },
          });

          const verifyData = await verifyResponse.json();
          paystackStatus = verifyData.status ? verifyData.data : null;
        } catch (error) {
          console.error('Error verifying with Paystack:', error);
        }
      }
    }

    // Get wallet balance if it's a wallet topup
    let walletBalance = null;
    if (payment.purpose === 'wallet_topup') {
      const { data: wallet } = await supabaseClient
        .from('wallets')
        .select('balance')
        .eq('user_id', payment.user_id)
        .single();
      
      walletBalance = wallet?.balance || 0;
    }

    // Get related records based on purpose
    let relatedRecords = null;
    if (payment.enhanced_status === 'success') {
      if (payment.purpose === 'rental') {
        const { data: rental } = await supabaseClient
          .from('rentals')
          .select('*')
          .eq('user_id', payment.user_id)
          .eq('content_id', payment.metadata?.content_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        relatedRecords = rental;
      } else if (payment.purpose === 'purchase') {
        const { data: purchase } = await supabaseClient
          .from('purchases')
          .select('*')
          .eq('user_id', payment.user_id)
          .eq('content_id', payment.metadata?.content_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        relatedRecords = purchase;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.enhanced_status,
        purpose: payment.purpose,
        created_at: payment.created_at,
        updated_at: payment.updated_at,
        provider: payment.provider,
        provider_reference: payment.provider_reference,
        metadata: payment.metadata,
        error_message: payment.error_message
      },
      paystack_status: paystackStatus,
      wallet_balance: walletBalance,
      related_records: relatedRecords
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in verify-payment:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
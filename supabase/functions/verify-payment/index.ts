import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, jsonResponse, handleOptions, errorResponse } from "../_shared/cors.ts";
import { authenticateUser } from "../_shared/auth.ts";

serve(async (req) => {
  // Handle CORS preflight
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    // Authenticate user
    const { user, supabase } = await authenticateUser(req);
    
    const url = new URL(req.url);
    const paymentId = url.searchParams.get('payment_id');
    const reference = url.searchParams.get('reference');
    
    if (!paymentId && !reference) {
      return errorResponse("payment_id or reference is required", 400);
    }

    // Get payment details
    let query = supabase
      .from('payments')
      .select('*');
      
    if (paymentId) {
      query = query.eq('id', paymentId);
    } else {
      query = query.eq('provider_reference', reference);
    }

    const { data: payment, error: paymentError } = await query.single();

    if (paymentError || !payment) {
      return errorResponse("Payment not found", 404);
    }

    // Check if user has access to this payment (or is admin)
    const { data: isAdmin } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (payment.user_id !== user.id && !isAdmin) {
      return errorResponse("Access denied", 403);
    }

    let result: any = {
      payment,
      paystack_status: null,
      wallet_balance: null,
      related_records: null
    };

    // Verify with Paystack if it's a Paystack payment
    if (payment.provider === 'paystack' && payment.provider_reference) {
      const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
      if (paystackSecretKey) {
        try {
          const paystackResponse = await fetch(
            `https://api.paystack.co/transaction/verify/${payment.provider_reference}`,
            {
              headers: {
                Authorization: `Bearer ${paystackSecretKey}`,
              },
            }
          );

          if (paystackResponse.ok) {
            const paystackData = await paystackResponse.json();
            result.paystack_status = paystackData.data;
          }
        } catch (error) {
          console.error('Paystack verification error:', error);
        }
      }
    }

    // Get wallet balance if it's a wallet topup
    if (payment.purpose === 'wallet_topup') {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', payment.user_id)
        .single();

      result.wallet_balance = wallet?.balance || 0;
    }

    // Get related records if payment is successful
    if (payment.enhanced_status === 'completed') {
      if (payment.purpose === 'rental') {
        const { data: rentals } = await supabase
          .from('rentals')
          .select('*')
          .eq('user_id', payment.user_id)
          .eq('content_id', payment.metadata?.content_id)
          .order('created_at', { ascending: false })
          .limit(1);

        result.related_records = { rentals };
      } else if (payment.purpose === 'purchase') {
        const { data: purchases } = await supabase
          .from('purchases')
          .select('*')
          .eq('user_id', payment.user_id)
          .eq('content_id', payment.metadata?.content_id)
          .order('created_at', { ascending: false })
          .limit(1);

        result.related_records = { purchases };
      }
    }

    return jsonResponse({
      success: true,
      ...result
    });

  } catch (error: any) {
    console.error("Error in verify-payment:", error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
});
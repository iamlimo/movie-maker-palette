import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { corsHeaders, jsonResponse, errorResponse, handleOptions } from '../_shared/cors.ts'

const corsHeadersExtended = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check if user is super admin
    const { data: isSuperAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'super_admin'
    });

    if (roleError || !isSuperAdmin) {
      return errorResponse('Forbidden: Super admin access required', 403);
    }

    const { targetUserId, amount, type, reason } = await req.json();

    if (!targetUserId || !amount || !type || !reason) {
      return errorResponse('Missing required fields', 400);
    }

    if (type !== 'credit' && type !== 'debit') {
      return errorResponse('Invalid transaction type', 400);
    }

    if (amount <= 0) {
      return errorResponse('Amount must be positive', 400);
    }

    if (reason.length < 10) {
      return errorResponse('Reason must be at least 10 characters', 400);
    }

    // Get target user's wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('wallet_id, balance')
      .eq('user_id', targetUserId)
      .single();

    if (!wallet) {
      return errorResponse('Target user wallet not found', 404);
    }

    // Process adjustment
    const { data: transactionId, error: txError } = await supabase.rpc('process_wallet_transaction', {
      p_wallet_id: wallet.wallet_id,
      p_amount: amount,
      p_type: type,
      p_description: `Admin adjustment: ${reason}`,
      p_metadata: { 
        admin_user_id: user.id,
        reason: reason,
        adjustment_type: 'manual'
      }
    });

    if (txError) {
      console.error('Transaction error:', txError);
      throw txError;
    }

    console.log('Wallet transaction completed:', transactionId);

    // Log finance action
    await supabase.rpc('log_finance_action', {
      p_action: `wallet_${type}`,
      p_details: {
        admin_user_id: user.id,
        target_user_id: targetUserId,
        amount: amount,
        reason: reason,
        transaction_id: transactionId
      }
    });

    // Get updated balance
    const { data: updatedWallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('wallet_id', wallet.wallet_id)
      .single();

    return jsonResponse({
      success: true,
      transaction_id: transactionId,
      new_balance: updatedWallet?.balance || 0,
      type: type,
      amount: amount
    });

  } catch (error: any) {
    console.error('Admin wallet adjustment error:', error);
    return errorResponse('An unexpected error occurred', 500);
  }
});

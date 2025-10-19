import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is super admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (userRole?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Super admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { targetUserId, amount, type, reason } = await req.json();

    if (!targetUserId || !amount || !type || !reason) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (type !== 'credit' && type !== 'debit') {
      return new Response(JSON.stringify({ error: 'Invalid transaction type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: 'Amount must be positive' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (reason.length < 10) {
      return new Response(JSON.stringify({ error: 'Reason must be at least 10 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get target user's wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('wallet_id, balance')
      .eq('user_id', targetUserId)
      .single();

    if (!wallet) {
      return new Response(JSON.stringify({ error: 'Target user wallet not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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

    return new Response(JSON.stringify({
      success: true,
      transaction_id: transactionId,
      new_balance: updatedWallet?.balance || 0,
      type: type,
      amount: amount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Admin wallet adjustment error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

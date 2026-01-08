import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteAccountRequest {
  password: string;
  deletion_reason?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { password, deletion_reason } = await req.json() as DeleteAccountRequest;

    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Password is required for account deletion' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User client for authentication
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Re-authenticate user with password to verify identity
    const { error: signInError } = await userClient.auth.signInWithPassword({
      email: user.email!,
      password: password,
    });

    if (signInError) {
      return new Response(
        JSON.stringify({ error: 'Invalid password. Please verify your credentials.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for data deletion
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const deletedData: string[] = [];

    // 1. Delete wallet transactions first (depends on wallet)
    const { data: wallet } = await adminClient
      .from('wallets')
      .select('wallet_id')
      .eq('user_id', user.id)
      .single();

    if (wallet) {
      await adminClient
        .from('wallet_transactions')
        .delete()
        .eq('wallet_id', wallet.wallet_id);
      deletedData.push('wallet_transactions');

      await adminClient
        .from('wallets')
        .delete()
        .eq('user_id', user.id);
      deletedData.push('wallet');
    }

    // 2. Delete user preferences
    await adminClient
      .from('user_preferences')
      .delete()
      .eq('user_id', user.id);
    deletedData.push('preferences');

    // 3. Delete watch history
    await adminClient
      .from('watch_history')
      .delete()
      .eq('user_id', user.id);
    deletedData.push('watch_history');

    // 4. Delete favorites
    await adminClient
      .from('favorites')
      .delete()
      .eq('user_id', user.id);
    deletedData.push('favorites');

    // 5. Delete rentals
    await adminClient
      .from('rentals')
      .delete()
      .eq('user_id', user.id);
    deletedData.push('rentals');

    // 6. Delete purchases
    await adminClient
      .from('purchases')
      .delete()
      .eq('user_id', user.id);
    deletedData.push('purchases');

    // 7. Delete payments
    await adminClient
      .from('payments')
      .delete()
      .eq('user_id', user.id);
    deletedData.push('payments');

    // 8. Delete user roles
    await adminClient
      .from('user_roles')
      .delete()
      .eq('user_id', user.id);
    deletedData.push('user_roles');

    // 9. Log deletion for audit (before profile deletion)
    await adminClient
      .from('finance_audit_logs')
      .insert({
        actor_id: user.id,
        action: 'account_self_deletion',
        details: {
          user_email: user.email,
          deletion_reason: deletion_reason || 'Not provided',
          deleted_data: deletedData,
          deleted_at: new Date().toISOString(),
        }
      });

    // 10. Delete profile
    await adminClient
      .from('profiles')
      .delete()
      .eq('user_id', user.id);
    deletedData.push('profile');

    // 11. Finally delete the auth user
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id);
    
    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete authentication account. Please contact support.',
          partial_deletion: true,
          deleted_data: deletedData
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    deletedData.push('auth_account');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Your account has been permanently deleted',
        deleted_data: deletedData
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Account deletion error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred during account deletion' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

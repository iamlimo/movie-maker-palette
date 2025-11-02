import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/auth.ts";
import { validateEmail, sanitizeInput } from "../_shared/validation.ts";

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

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify super admin role
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'super_admin') {
      throw new Error('Insufficient permissions. Super admin access required.');
    }

    // Rate limiting: 20 requests per minute per admin
    if (!checkRateLimit(user.id, 20, 60000)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const requestBody = await req.json();
    const sanitized = sanitizeInput(requestBody);
    const { action, email, name, password, role, user_id } = sanitized;

    // CREATE USER
    if (action === 'create') {
      if (!email || !name) {
        throw new Error('Email and name are required');
      }

      // Validate email format
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        throw new Error(emailValidation.errors[0]);
      }

      const generatedPassword = password || `${Math.random().toString(36).slice(-8)}${Math.random().toString(36).slice(-8)}`;

      // Create auth user
      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: { name }
      });

      if (createError) throw createError;

      // Profile and wallet will be created automatically by triggers
      // Update role if not 'user'
      if (role && role !== 'user') {
        const { error: roleUpdateError } = await supabaseClient
          .from('user_roles')
          .update({ role })
          .eq('user_id', newUser.user.id);

        if (roleUpdateError) throw roleUpdateError;
      }

      // Log action
      await supabaseClient.rpc('log_finance_action', {
        p_action: 'user_created',
        p_details: {
          created_user_id: newUser.user.id,
          email,
          name,
          role: role || 'user',
          admin_id: user.id
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          user_id: newUser.user.id,
          password: password ? null : generatedPassword
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SUSPEND USER
    if (action === 'suspend') {
      if (!user_id) {
        throw new Error('user_id is required');
      }

      const { error: suspendError } = await supabaseClient
        .from('profiles')
        .update({ status: 'suspended' })
        .eq('user_id', user_id);

      if (suspendError) throw suspendError;

      // Log action
      await supabaseClient.rpc('log_finance_action', {
        p_action: 'user_suspended',
        p_details: {
          suspended_user_id: user_id,
          admin_id: user.id
        }
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTIVATE USER
    if (action === 'activate') {
      if (!user_id) {
        throw new Error('user_id is required');
      }

      const { error: activateError } = await supabaseClient
        .from('profiles')
        .update({ status: 'active' })
        .eq('user_id', user_id);

      if (activateError) throw activateError;

      // Log action
      await supabaseClient.rpc('log_finance_action', {
        p_action: 'user_activated',
        p_details: {
          activated_user_id: user_id,
          admin_id: user.id
        }
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE USER
    if (action === 'delete') {
      if (!user_id) {
        throw new Error('user_id is required');
      }

      // Log action before deletion
      await supabaseClient.rpc('log_finance_action', {
        p_action: 'user_deleted',
        p_details: {
          deleted_user_id: user_id,
          admin_id: user.id
        }
      });

      // Delete from auth (cascade will handle related records)
      const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(user_id);

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error: any) {
    console.error('Error in admin-user-management:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred processing your request' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

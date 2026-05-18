import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { checkRateLimit } from "../_shared/auth.ts";
import { sanitizeInput } from "../_shared/validation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get auth token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit
    if (!checkRateLimit(user.id, 5, 60000)) {
      return new Response(JSON.stringify({ error: 'Too many payment requests. Please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const requestBody = await req.json();
    const sanitized = sanitizeInput(requestBody);
    const { contentId, contentType, price, referralCode } = sanitized;

    if (!contentId || !contentType || typeof price !== 'number') {
      return new Response(JSON.stringify({ error: 'Missing required fields: contentId, contentType, price' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delegate wallet payments to unified process-rental with paymentMethod='wallet'
    const processRentalUrl = `${supabaseUrl}/functions/v1/process-rental`;
    const response = await fetch(processRentalUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        contentId,
        contentType,
        price,
        paymentMethod: 'wallet',
        referralCode,
      }),
    });

    const result = await response.json();

    // Backward-compatible legacy payload shape
    if (!response.ok || !result?.success) {
      return new Response(JSON.stringify({ error: result?.error || 'Failed to process wallet rental' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      payment_method: 'wallet',
      rental_expires_at: result?.rentalExpiresAt ?? null,
      discount_applied: result?.discountApplied ?? undefined,
      message: 'DEPRECATED: Use /process-rental instead',
      rentalId: result?.rentalId,
      paymentId: result?.paymentId,
      walletBalance: result?.walletBalance,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Failed to process wallet payment' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

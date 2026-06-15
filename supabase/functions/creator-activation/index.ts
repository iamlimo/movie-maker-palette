import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return jsonResponse({ success: false, error: "Method not allowed" }, 405);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse({ success: false, error: "Invalid request body" }, 400);
    }

    const { token, password } = body as { token?: string; password?: string };

    if (!token || !password) {
      return jsonResponse({ success: false, error: "Missing required fields: token, password" }, 400);
    }

    const tokenHash = await sha256Hex(token);

    // Validate token (exists, unused, not expired)
    const nowIso = new Date().toISOString();
    const { data: tokenRow, error: tokenQueryError } = await supabase
      .from("creator_activation_tokens")
      .select("user_id, used, expires_at")
      .eq("token_hash", tokenHash)
      .single();

    if (tokenQueryError || !tokenRow) {
      return jsonResponse({ success: false, error: "Invalid token" }, 400);
    }

    if (tokenRow.used) {
      return jsonResponse({ success: false, error: "Token already used" }, 400);
    }

    if (tokenRow.expires_at && tokenRow.expires_at <= nowIso) {
      return jsonResponse({ success: false, error: "Token expired" }, 400);
    }

    const userId = tokenRow.user_id;

    // Update auth password
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password,
    });

    if (updateError) throw updateError;

    // Activate creator profile
    const { error: profileError } = await supabase
      .from("creator_profiles")
      .update({
        active: true,
        is_active: true, // harmless if column doesn't exist; if it errors, we catch below
      })
      .eq("user_id", userId);

    if (profileError) {
      // Fallback: try only `active`
      const { error: profileError2 } = await supabase
        .from("creator_profiles")
        .update({ active: true })
        .eq("user_id", userId);
      if (profileError2) throw profileError2;
    }

    // Mark token as used (and optionally consume)
    const { error: useError } = await supabase
      .from("creator_activation_tokens")
      .update({ used: true })
      .eq("token_hash", tokenHash);

    if (useError) throw useError;

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("creator-activation error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return jsonResponse({ success: false, error: message }, 400);
  }
});

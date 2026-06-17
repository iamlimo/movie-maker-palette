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

    const getEnv = (key: string): string => {
      const g: unknown = globalThis;
      const denoObj =
        typeof g === "object" && g !== null && "Deno" in g
          ? (g as { Deno?: unknown }).Deno
          : undefined;

      if (
        denoObj &&
        typeof denoObj === "object" &&
        "env" in denoObj
      ) {
        const envObj = (denoObj as { env?: unknown }).env;
        if (envObj && typeof envObj === "object" && "get" in envObj) {
          const getter = (envObj as { get?: unknown }).get;
          if (typeof getter === "function") {
            const val = (getter as (k: string) => unknown)(key);
            return typeof val === "string" ? val : "";
          }
        }
      }

      return "";
    };

    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY"),
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

    const now = new Date();

    // Validate token (exists, unused, not expired)
    const { data: tokenRow, error: tokenQueryError } = await supabase
      .from("creator_activation_tokens")
      .select("creator_profile_id, used_at, expires_at")
      .eq("token_hash", tokenHash)
      .single();

    if (tokenQueryError || !tokenRow) {
      return jsonResponse({ success: false, error: "Invalid token" }, 400);
    }

    if (tokenRow.used_at) {
      return jsonResponse({ success: false, error: "Token already used" }, 400);
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) <= now) {
      return jsonResponse({ success: false, error: "Token expired" }, 400);
    }

    const creatorProfileId = tokenRow.creator_profile_id;
    if (!creatorProfileId) {
      return jsonResponse({ success: false, error: "Invalid token linkage" }, 400);
    }

    // Load creator profile details for auth creation
    const { data: creatorProfile, error: creatorProfileError } = await supabase
      .from("creator_profiles")
      .select("id, email, display_name, phone_number, company_name, creator_type, user_id, is_active")
      .eq("id", creatorProfileId)
      .single();

    if (creatorProfileError || !creatorProfile) {
      return jsonResponse({ success: false, error: "Creator profile not found" }, 400);
    }

    if (creatorProfile.user_id) {
      return jsonResponse({ success: false, error: "Creator already activated" }, 400);
    }

    // 1) Create auth user now
    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: creatorProfile.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: creatorProfile.display_name,
        phone_number: creatorProfile.phone_number,
        company_name: creatorProfile.company_name,
        creator_type: creatorProfile.creator_type,
      },
    });

    if (createUserError || !createdUser?.user?.id) {
      throw createUserError ?? new Error("Failed to create auth user");
    }

    const userId = createdUser.user.id;

    // 2) Activate creator profile
    const { error: profileUpdateError } = await supabase
      .from("creator_profiles")
      .update({
        user_id: userId,
        is_active: true,
        password_not_set: false,
        status: "active",
        updated_at: now.toISOString(),
      })
      .eq("id", creatorProfileId);

    if (profileUpdateError) throw profileUpdateError;

    // 3) Mark token used
    const { error: useError } = await supabase
      .from("creator_activation_tokens")
      .update({ used_at: now.toISOString() })
      .eq("token_hash", tokenHash);

    if (useError) throw useError;

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("creator-activation error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return jsonResponse({ success: false, error: message }, 400);
  }
});

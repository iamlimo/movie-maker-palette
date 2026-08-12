import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CREATOR_TYPES = ["producer", "director", "studio", "content_owner", "distributor"];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomPassword(length = 14) {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

const getEnv = (key: string): string => {
  const g = globalThis as unknown as { Deno?: { env?: { get?: (k: string) => string | undefined } } };
  return g.Deno?.env?.get?.(key) ?? "";
};

async function requireAdmin(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { ok: false as const, status: 401, error: "No authorization header" };

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);

  const list = (roles ?? []).map((r: { role: string }) => r.role);
  if (!list.includes("admin") && !list.includes("super_admin")) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, status: 200, user: userData.user };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return jsonResponse({ success: false, error: "Method not allowed" }, 405);
    }

    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));

    const adminCheck = await requireAdmin(req, supabase);
    if (!adminCheck.ok) {
      return jsonResponse({ success: false, error: adminCheck.error }, adminCheck.status);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse({ success: false, error: "Invalid request body" }, 400);
    }

    const {
      action = "create",
      creatorProfileId,
      email,
      fullName,
      password,
      phone,
      companyName,
      address,
      creatorType,
      redirectTo,
    } = body as Record<string, string | undefined>;

    const resetRedirect = redirectTo || `${req.headers.get("origin") ?? "https://signaturetv.co"}/reset-password`;

    /* -------------------------------------------------- ACTIVATE */
    if (action === "activate" || action === "deactivate") {
      if (!creatorProfileId) {
        return jsonResponse({ success: false, error: "creatorProfileId is required" }, 400);
      }

      const { data: profile, error: profileError } = await supabase
        .from("creator_profiles")
        .select("id, email, display_name, user_id")
        .eq("id", creatorProfileId)
        .maybeSingle();

      if (profileError || !profile) {
        return jsonResponse({ success: false, error: "Creator profile not found" }, 404);
      }

      const activating = action === "activate";

      if (activating && !profile.user_id) {
        return jsonResponse(
          { success: false, error: "Creator has no login account yet. Re-create the creator." },
          400,
        );
      }

      const { error: updateError } = await supabase
        .from("creator_profiles")
        .update({
          status: activating ? "active" : "disabled",
          is_active: activating,
          updated_at: new Date().toISOString(),
        })
        .eq("id", creatorProfileId);

      if (updateError) throw updateError;

      if (profile.user_id) {
        if (activating) {
          await supabase
            .from("user_roles")
            .upsert({ user_id: profile.user_id, role: "creator" }, { onConflict: "user_id,role" });
        } else {
          await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", profile.user_id)
            .eq("role", "creator");
        }
      }

      let emailSent = false;
      if (activating && profile.email) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(profile.email, {
          redirectTo: resetRedirect,
        });
        emailSent = !resetError;
        if (resetError) console.warn("[admin-create-creator] reset email failed", resetError.message);
      }

      return jsonResponse({ success: true, emailSent });
    }

    /* -------------------------------------------------- SEND RESET */
    if (action === "send_reset") {
      if (!email) return jsonResponse({ success: false, error: "email is required" }, 400);
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: resetRedirect });
      if (error) throw error;
      return jsonResponse({ success: true, emailSent: true });
    }

    /* -------------------------------------------------- CREATE */
    const missing: string[] = [];
    if (!email) missing.push("email");
    if (!fullName) missing.push("fullName");
    if (!phone) missing.push("phone");
    if (!companyName) missing.push("companyName");
    if (!creatorType) missing.push("creatorType");
    if (missing.length) {
      return jsonResponse(
        { success: false, error: `Missing required fields: ${missing.join(", ")}` },
        400,
      );
    }

    const normalizedType = String(creatorType).toLowerCase();
    if (!CREATOR_TYPES.includes(normalizedType)) {
      return jsonResponse(
        { success: false, error: `creatorType must be one of: ${CREATOR_TYPES.join(", ")}` },
        400,
      );
    }

    if (password && String(password).length < 8) {
      return jsonResponse({ success: false, error: "Password must be at least 8 characters" }, 400);
    }

    const finalPassword = password || randomPassword();

    // 1) Create the auth login up front so the creator can sign in once activated.
    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: String(email),
      password: finalPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone_number: phone,
        company_name: companyName,
        creator_type: normalizedType,
        is_creator: true,
      },
    });

    if (createUserError || !createdUser?.user?.id) {
      const msg = createUserError?.message ?? "Failed to create login account";
      const status = /already|exists|registered/i.test(msg) ? 409 : 400;
      return jsonResponse({ success: false, error: msg }, status);
    }

    const userId = createdUser.user.id;

    // 2) Creator profile in "pending activation" until an admin activates it.
    const { data: profileRow, error: profileError } = await supabase
      .from("creator_profiles")
      .insert({
        user_id: userId,
        display_name: fullName,
        email,
        phone_number: phone,
        company_name: companyName,
        address: address ?? null,
        creator_type: normalizedType,
        status: "pending_activation",
        is_active: false,
        password_not_set: true,
        created_by: adminCheck.user.id,
      })
      .select("id")
      .single();

    if (profileError || !profileRow?.id) {
      // Roll back the orphaned auth user so retries work.
      await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
      const msg = profileError?.message ?? "Failed to create creator profile";
      return jsonResponse({ success: false, error: msg }, /duplicate|unique/i.test(msg) ? 409 : 400);
    }

    // 3) Notify the creator to set their own password.
    let emailSent = false;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(String(email), {
      redirectTo: resetRedirect,
    });
    emailSent = !resetError;
    if (resetError) console.warn("[admin-create-creator] reset email failed", resetError.message);

    return jsonResponse({
      success: true,
      creator_profile_id: profileRow.id,
      user_id: userId,
      password: finalPassword,
      emailSent,
    });
  } catch (err) {
    console.error("admin-create-creator error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return jsonResponse({ success: false, error: message }, 500);
  }
});

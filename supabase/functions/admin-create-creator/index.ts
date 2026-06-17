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

function randomPassword(length = 20) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

function randomUuid() {
  // Prefer native UUID if available
  // Deno also supports crypto.randomUUID
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

async function requireAdmin(
  req: Request,
  supabase: ReturnType<typeof createClient>,
) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { ok: false as const, status: 401, error: "No authorization header" };

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData?.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const { data: roleData, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .single();

  if (roleError || !roleData) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  const role = roleData.role;
  if (role !== "admin" && role !== "super_admin") {
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

    const getEnv = (key: string): string => {
      const g: unknown = globalThis;
      const denoObj =
        typeof g === "object" && g !== null && "Deno" in g
          ? (g as { Deno?: unknown }).Deno
          : undefined;

      if (denoObj && typeof denoObj === "object" && "env" in denoObj) {
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

    // ---- Auth / role check diagnostics ----
    const authHeader = req.headers.get("Authorization") ?? "";
    console.info("[admin-create-creator] start", {
      hasAuthHeader: authHeader.startsWith("Bearer "),
    });

    const adminCheck = await requireAdmin(req, supabase);
    if (!adminCheck.ok) {
      console.warn("[admin-create-creator] adminCheck failed", {
        status: adminCheck.status,
        error: adminCheck.error,
      });
      return jsonResponse(
        { success: false, error: adminCheck.error, debug: { stage: "requireAdmin" } },
        adminCheck.status,
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      console.warn("[admin-create-creator] invalid request body");
      return jsonResponse({ success: false, error: "Invalid request body" }, 400);
    }

    const {
      email,
      fullName,
      phone,
      companyName,
      creatorType,
    } = body as {
      email?: string;
      fullName?: string;
      phone?: string;
      companyName?: string;
      creatorType?: string;
    };

    // ---- Payload diagnostics (no secrets) ----
    const missing: string[] = [];
    if (!email) missing.push("email");
    if (!fullName) missing.push("fullName");
    if (!phone) missing.push("phone");
    if (!companyName) missing.push("companyName");
    if (!creatorType) missing.push("creatorType");

    if (missing.length) {
      console.warn("[admin-create-creator] missing required fields", { missing });
      return jsonResponse(
        { success: false, error: `Missing required fields: ${missing.join(", ")}` },
        400,
      );
    }

    console.info("[admin-create-creator] payload received", {
      creatorType,
      email,
      hasPhone: Boolean(phone),
      hasCompanyName: Boolean(companyName),
      hasFullName: Boolean(fullName),
    });

    const activationTokenRaw = randomUuid();
    const activationTokenHash = await sha256Hex(activationTokenRaw);
    const generatedPassword = randomPassword(22);

    // Requested behavior: DO NOT create auth.users yet (prevents "ghost" logins).
    // We only create:
    // 1) creator_profiles (inactive/pending)
    // 2) creator_activation_tokens (one-time activation token)

    // ---- Insert creator profile (diagnostics) ----
    let creatorProfileId: string;

    try {
      const { data: profileRow, error: profileError } = await supabase
        .from("creator_profiles")
        .insert({
          display_name: fullName, // schema uses display_name
          email,
          phone_number: phone,
          company_name: companyName,
          creator_type: creatorType,
          status: "pending_activation",
          is_active: false,
          password_not_set: true,
          created_by: null,
        })
        .select("id")
        .single();

      if (profileError || !profileRow?.id) {
        throw profileError ?? new Error("Failed to create creator profile");
      }

      creatorProfileId = profileRow.id;
    } catch (e) {
      console.error("[admin-create-creator] creator_profiles insert failed", e);
      throw new Error(
        `creator_profiles insert failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    // ---- Insert activation token (diagnostics) ----
    try {
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
      const { error: tokenError } = await supabase
        .from("creator_activation_tokens")
        .insert({
          token_hash: activationTokenHash,
          creator_profile_id: creatorProfileId,
          expires_at: expiresAt.toISOString(),
          used_at: null,
        });

      if (tokenError) throw tokenError;
    } catch (e) {
      console.error("[admin-create-creator] creator_activation_tokens insert failed", e);
      throw new Error(
        `creator_activation_tokens insert failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    // Return temporary password as well so admin UI can perform activation immediately if desired.
    return jsonResponse({
      success: true,
      token: activationTokenRaw,
      creator_profile_id: creatorProfileId,
      password: generatedPassword,
    });
  } catch (err) {
    // ---- Better status mapping (don’t collapse everything to 400) ----
    console.error("admin-create-creator error:", err);

    const message = err instanceof Error ? err.message : "Internal error";
    const lower = message.toLowerCase();

    // Postgres / supabase-js common markers
    const status =
      lower.includes("forbidden") ? 403
        : lower.includes("unauthorized") ? 401
          : lower.includes("too many") ? 429
            : lower.includes("unique") ? 409
              : lower.includes("violates") ? 400
                : lower.includes("foreign key") ? 400
                  : lower.includes("not null") ? 400
                    : 500;

    return jsonResponse(
      {
        success: false,
        error: message,
        debug: {
          computed_status: status,
          // NOTE: no auth secrets returned
        },
      },
      status,
    );
  }
});

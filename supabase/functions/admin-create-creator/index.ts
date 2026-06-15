/// <reference lib="deno.ns" />
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const adminCheck = await requireAdmin(req, supabase);
    if (!adminCheck.ok) return jsonResponse({ success: false, error: adminCheck.error }, adminCheck.status);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
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

    if (!email || !fullName || !phone || !companyName || !creatorType) {
      return jsonResponse(
        { success: false, error: "Missing required fields: email, fullName, phone, companyName, creatorType" },
        400,
      );
    }

    const activationTokenRaw = randomUuid();
    const activationTokenHash = await sha256Hex(activationTokenRaw);
    const generatedPassword = randomPassword(22);

    // 1) Create auth user
    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone_number: phone,
        company_name: companyName,
        creator_type: creatorType,
      },
    });

    if (createUserError || !createdUser?.user?.id) {
      throw createUserError ?? new Error("Failed to create auth user");
    }

    const userId = createdUser.user.id;

    // 2) Insert creator profile
    // Column names can vary slightly; adjust if needed after aligning with schema.
    const { error: profileError } = await supabase.from("creator_profiles").insert({
      user_id: userId,
      full_name: fullName,
      phone_number: phone,
      company_name: companyName,
      creator_type: creatorType,
      active: false,
    });

    if (profileError) throw profileError;

    // 3) Insert activation token record
    // Store hash only; mark unused. expires_at set if column exists; otherwise omit.
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

    const { error: tokenError } = await supabase.from("creator_activation_tokens").insert({
      user_id: userId,
      token_hash: activationTokenHash,
      used: false,
      expires_at: expiresAt.toISOString(),
    });

    if (tokenError) throw tokenError;

    return jsonResponse({
      success: true,
      token: activationTokenRaw,
      user_id: userId,
    });
  } catch (err) {
    console.error("admin-create-creator error:", err);
    const message = err instanceof Error ? err.message : "Internal error";

    const lower = message.toLowerCase();
    const status =
      lower.includes("forbidden") ? 403
        : lower.includes("unauthorized") ? 401
          : lower.includes("too many") ? 429
            : 400;

    return jsonResponse({ success: false, error: message, debug: { computed_status: status } }, status);
  }
});

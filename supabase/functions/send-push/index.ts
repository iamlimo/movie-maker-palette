/* eslint-disable */
/* @ts-nocheck */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import firebaseAdmin from "https://esm.sh/firebase-admin@6.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "3600",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildEnvGetter() {
  return (key: string): string => {
    const g: unknown = globalThis;
    const denoObj = typeof g === "object" && g !== null && "Deno" in g
      ? (g as { Deno?: unknown }).Deno
      : undefined;

    if (denoObj && typeof denoObj === "object" && "env" in denoObj) {
      const envObj = denoObj as { env?: { get?: (k: string) => unknown } };
      const getter = envObj.env?.get;
      if (typeof getter === "function") {
        const val = getter(key);
        return typeof val === "string" ? val : "";
      }
    }
    return "";
  };
}

function requireBearer(req: Request): string {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) throw new Error("Unauthorized");
  return auth.slice("Bearer ".length);
}

async function requireAdmin(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  // Preferred: profiles.is_admin boolean
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profileErr && profile?.is_admin === true) return true;

  // Fallback: user_roles.role mapping
  const { data: roleRow, error: roleErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleErr) return false;
  return roleRow?.role === "admin" || roleRow?.role === "super_admin";
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildDeepLinkData(input: {
  target_screen: string;
  entity_id: string;
  notification_id: string | null;
  silent: boolean;
  title: string;
  body: string;
  extraData: Record<string, unknown>;
}): Record<string, string> {
  if (!input.target_screen) throw new Error("data.target_screen is required");
  if (!input.entity_id) throw new Error("data.entity_id is required");

  const out: Record<string, string> = {
    target_screen: input.target_screen,
    entity_id: input.entity_id,
    notification_id: input.notification_id ? input.notification_id : "",
    silent: input.silent ? "true" : "false",
    title: input.title ?? "",
    body: input.body ?? "",
  };

  for (const [k, v] of Object.entries(input.extraData ?? {})) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }

  return out;
}

let firebaseApp: firebaseAdmin.app.App | null = null;
function getFirebaseAdmin(appEnv: { serviceAccountJson: string }) {
  if (firebaseApp) return firebaseApp;

  const sa = JSON.parse(appEnv.serviceAccountJson) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  if (!sa.project_id) throw new Error("FIREBASE_SERVICE_ACCOUNT is not configured");

  firebaseApp = firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(sa),
  });

  return firebaseApp;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const getEnv = buildEnvGetter();
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = getEnv("SUPABASE_ANON_KEY");
    const serviceAccountJson = getEnv("FIREBASE_SERVICE_ACCOUNT");

    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server not configured" }, 500);
    if (!serviceAccountJson) return json({ error: "FIREBASE_SERVICE_ACCOUNT missing" }, 500);

    const token = requireBearer(req);

    const supabaseService = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAnon = createClient(supabaseUrl, anonKey);

    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const userId = userData.user.id;
    const isAdmin = await requireAdmin(supabaseService, userId);
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = (await req.json().catch(() => ({}))) as {
      title?: unknown;
      body?: unknown;
      silent?: unknown;
      target?: unknown;
      target_user_id?: unknown;
      target_screen?: unknown;
      entity_id?: unknown;
      notification_id?: unknown;
      data?: Record<string, unknown>;
    };

    const title = typeof body.title === "string" ? body.title : "";
    const bodyText = typeof body.body === "string" ? body.body : "";
    if (!title || !bodyText) return json({ error: "title and body are required" }, 400);

    const silent = Boolean(body.silent);
    const target = typeof body.target === "string" ? body.target : "all";
    const targetUserId = typeof body.target_user_id === "string" ? body.target_user_id : "";
    const targetScreen = typeof body.target_screen === "string" ? body.target_screen : "";
    const entityId = typeof body.entity_id === "string" ? body.entity_id : "";
    const notificationId = typeof body.notification_id === "string" ? body.notification_id : null;
    const extraData = body.data ?? {};

    if (target === "user" && !targetUserId) return json({ error: "target_user_id required" }, 400);
    // Enforce deep-link contract when building payload
    if (!targetScreen || !entityId) return json({ error: "data.target_screen and data.entity_id are required" }, 400);

    const { data: inserted, error: insertErr } = await supabaseService
      .from("push_notifications")
      .insert({
        title,
        body: bodyText,
        data: extraData,
        target,
        target_user_id: target === "user" ? targetUserId : null,
        sent_count: 0,
        created_by: userId,
      })
      .select("id")
      .maybeSingle();

    if (insertErr) throw new Error(`Failed to insert push_notifications: ${insertErr.message}`);

    const notifId: string | null = inserted?.id ?? null;

    let tokenQuery = supabaseService
      .from("push_device_tokens")
      .select("token")
      .eq("is_active", true);

    if (target === "user") {
      tokenQuery = tokenQuery.eq("user_id", targetUserId);
    }

    const { data: tokens, error: tokensErr } = await tokenQuery;
    if (tokensErr) throw new Error(`Failed to fetch tokens: ${tokensErr.message}`);

    const tokenList: string[] = (tokens ?? [])
      .map((t: { token?: unknown }) => (typeof t.token === "string" ? t.token : ""))
      .filter((t: string) => Boolean(t));

    if (tokenList.length === 0) {
      return json({
        success: true,
        sent_count: 0,
        total_tokens: 0,
        notification_id: notifId,
      });
    }

    const deepLinkData = buildDeepLinkData({
      target_screen: targetScreen,
      entity_id: entityId,
      notification_id: notifId,
      silent,
      title,
      body: bodyText,
      extraData,
    });

    const chunks = chunkArray(tokenList, 500);
    let sentCount = 0;
    const invalidTokens: string[] = [];

    const app = getFirebaseAdmin({ serviceAccountJson });

    for (const chunk of chunks) {
      const message: firebaseAdmin.messaging.MulticastMessage = {
        tokens: chunk,
        data: deepLinkData,
        ...(silent
          ? {
              notification: undefined,
              apns: { payload: { aps: { contentAvailable: true, badge: 1 } } },
              android: { priority: "high" },
            }
          : {
              notification: { title, body: bodyText },
              apns: { payload: { aps: { sound: "default", badge: 1 } } },
              android: { priority: "high" },
            }),
      };

      const resp = await firebaseAdmin.messaging(app).sendEachForMulticast(message);

      sentCount += resp.successCount;

      resp.responses.forEach((r: { success: boolean; error?: unknown }, idx: number) => {
        if (r.success) return;

        const err = r.error as { code?: string } | undefined;
        const code = err?.code ?? "";
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
          invalidTokens.push(chunk[idx]);
        }
      });
    }

    if (invalidTokens.length) {
      const uniq = Array.from(new Set(invalidTokens));
      await supabaseService
        .from("push_device_tokens")
        .update({ is_active: false })
        .in("token", uniq);
    }

    if (notifId) {
      await supabaseService
        .from("push_notifications")
        .update({ sent_count: sentCount })
        .eq("id", notifId);
    }

    return json({
      success: true,
      sent_count: sentCount,
      total_tokens: tokenList.length,
      notification_id: notifId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500);
  }
});

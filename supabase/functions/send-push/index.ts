/* eslint-disable */
/* @ts-nocheck */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { sendPush } from "../_shared/push.ts";

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server not configured" }, 500);

    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = auth.slice("Bearer ".length);

    const supabaseService = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAnon = createClient(supabaseUrl, anonKey);

    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { data: isAdmin, error: roleErr } = await supabaseService.rpc("has_any_role", {
      _user_id: userId,
      _roles: ["admin", "super_admin"],
    });
    if (roleErr) console.error("[send-push] role check failed:", roleErr.message);
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const bodyText = typeof body.body === "string" ? body.body.trim() : "";
    if (!title || !bodyText) return json({ error: "title and body are required" }, 400);

    const silent = Boolean(body.silent);
    const target = body.target === "user" ? "user" : "all";
    const targetUserId = typeof body.target_user_id === "string" ? body.target_user_id : "";
    if (target === "user" && !targetUserId) return json({ error: "target_user_id required" }, 400);

    const targetScreen = typeof body.target_screen === "string" ? body.target_screen : "";
    const entityId = typeof body.entity_id === "string" ? body.entity_id : "";
    if (!targetScreen || !entityId) {
      return json({ error: "target_screen and entity_id are required" }, 400);
    }

    const extraData = (body.data ?? {}) as Record<string, unknown>;

    const result = await sendPush(supabaseService, {
      userId: target === "user" ? targetUserId : null,
      title,
      body: bodyText,
      silent,
      createdBy: userId,
      data: {
        ...extraData,
        target_screen: targetScreen,
        entity_id: entityId,
      },
    });

    if (result.skippedReason === "missing_service_account") {
      return json(
        {
          error:
            "Push service is not configured. Add the FIREBASE_SERVICE_ACCOUNT secret to enable sending.",
        },
        500,
      );
    }

    return json({
      success: true,
      sent_count: result.sentCount,
      total_tokens: result.totalTokens,
      notification_id: result.notificationId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[send-push] error:", message);
    return json({ error: message }, 500);
  }
});

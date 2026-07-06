/// <reference path="../deno.d.ts" />
/**
 * Rental Hard-Reset
 *
 * Admin-only endpoint to clear rental state anomalies caused by webhook drops
 * or clock skew (e.g., ACTIVE entitlement that has expired; PENDING stuck indefinitely).
 *
 * It operates on canonical tables:
 * - rental_access (revokes paid access when expires_at <= now)
 * - rental_intents (fails pending intents older than a threshold)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

import { formatLog, logRentalStep } from "../_shared/rental-logging.ts";
import { normalizeContentType } from "../_shared/rental.ts";

type AllowedContentType = "movie" | "season" | "episode";

const MAX_AGE_HOURS_PENDING_DEFAULT = 24;
const REVOKE_EXPIRED_SKEW_MINUTES = 5;

function getNowIso() {
  return new Date().toISOString();
}

function getSkewedNowIso(skewMinutes: number) {
  return new Date(Date.now() - skewMinutes * 60_000).toISOString();
}

function isAllowedContentType(value: string): value is AllowedContentType {
  const v = String(value).toLowerCase().trim();
  return v === "movie" || v === "season" || v === "episode";
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    if (req.method !== "POST") {
      return errorResponse("Method not allowed. Use POST.", 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return errorResponse("Server configuration error", 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return errorResponse("Unauthorized: missing bearer token", 401);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolve requester user
    const { data: authUser, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser?.user) {
      return errorResponse("Unauthorized", 401);
    }

    const requestedBy = authUser.user.id;

    // Role gate (must be super_admin or accounting)
    const { data: isAuthorized, error: roleErr } = await supabase.rpc("has_any_role", {
      _user_id: requestedBy,
      _roles: ["super_admin", "accounting"],
    });

    if (roleErr || !isAuthorized) {
      return errorResponse("Forbidden: super_admin or accounting access required", 403);
    }

    const body = await req.json().catch(() => ({})) as Partial<{
      userId: string;
      contentId: string;
      contentType: string;
      mode: "anomaly_fix" | "full_reset";
      maxAgeHoursPending: number;
    }>;

    const userId = body.userId;
    const contentId = body.contentId;
    const normalizedType = normalizeContentType(body.contentType || "");

    if (!userId || !contentId || !normalizedType || !isAllowedContentType(normalizedType)) {
      return errorResponse("Missing/invalid required fields: userId, contentId, contentType", 400);
    }

    const maxAgeHoursPending =
      typeof body.maxAgeHoursPending === "number" && body.maxAgeHoursPending > 0
        ? body.maxAgeHoursPending
        : MAX_AGE_HOURS_PENDING_DEFAULT;

    const now = getNowIso();
    const nowForRevocation = getSkewedNowIso(REVOKE_EXPIRED_SKEW_MINUTES);
    const pendingCutoffIso = new Date(Date.now() - maxAgeHoursPending * 60 * 60 * 1000).toISOString();

    // Best-effort rental audit log (doesn't affect outcome)
    try {
      await supabase.rpc("log_rental_step", {
        p_user_id: authUser.user.id,
        p_content_id: contentId,
        p_content_type: normalizedType,
        p_step: "validation",
        p_status: "success",
        p_message: formatLog("rental-hard-reset", `requested_by=${requestedBy}`, `mode=anomaly_fix pendingOlderThanHours=${maxAgeHoursPending}`),
        p_metadata: {
          requested_by: requestedBy,
          target_user_id: userId,
          content_id: contentId,
          content_type: normalizedType,
          now,
          pending_cutoff: pendingCutoffIso,
        },
        p_rental_intent_id: undefined,
        p_rental_access_id: undefined,
        p_payment_method: undefined,
        p_amount_kobo: undefined,
      });
    } catch {
      // ignore audit issues
    }

    // 1) Revoke expired ACTIVE anomalies (paid rental_access with expires_at in the past)
    // We revoke only those that are not already revoked.
    const { data: expiredAccessRows, error: expiredAccessErr } = await supabase
      .from("rental_access")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "paid")
      .is("revoked_at", null)
      .lte("expires_at", nowForRevocation)
      .eq(normalizedType === "movie" ? "movie_id" : normalizedType === "season" ? "season_id" : "episode_id", contentId);

    if (expiredAccessErr) {
      console.error("Expired access query failed:", expiredAccessErr);
      return errorResponse("Failed to query expired rental_access", 500);
    }

    const expiredAccessIds = (expiredAccessRows || []).map((r: { id: string }) => r.id);

    let expiredAccessRevokedCount = 0;
    if (expiredAccessIds.length > 0) {
      const { error: revokeErr } = await supabase
        .from("rental_access")
        .update({
          revoked_at: now,
          status: "failed",
          metadata: {
            expired_by: "rental-hard-reset",
            expired_at: now,
          },
        })
        .in("id", expiredAccessIds);

      if (revokeErr) {
        console.error("Expired access revoke failed:", revokeErr);
        return errorResponse("Failed to revoke expired rental_access", 500);
      }
      expiredAccessRevokedCount = expiredAccessIds.length;
    }

    // 2) Fail stuck pending intents older than threshold.
    // status is stored as "pending" in rental_intents (canonical).
    const cutoff = pendingCutoffIso;

    const contentKey =
      normalizedType === "movie" ? "movie_id" : normalizedType === "season" ? "season_id" : "episode_id";

    const { data: pendingIntentRows, error: pendingIntentsErr } = await supabase
      .from("rental_intents")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .lte("created_at", cutoff)
      .eq(contentKey, contentId);

    if (pendingIntentsErr) {
      console.error("Pending intents query failed:", pendingIntentsErr);
      return errorResponse("Failed to query pending rental_intents", 500);
    }

    const pendingIntentIds = (pendingIntentRows || []).map((r: { id: string }) => r.id);

    let pendingIntentsFailedCount = 0;
    if (pendingIntentIds.length > 0) {
      const { error: failIntentsErr } = await supabase
        .from("rental_intents")
        .update({ status: "failed", failed_at: now })
        .in("id", pendingIntentIds);

      if (failIntentsErr) {
        console.error("Pending intents failure update failed:", failIntentsErr);
        return errorResponse("Failed to fail pending rental_intents", 500);
      }
      pendingIntentsFailedCount = pendingIntentIds.length;
    }

    // 3) Safety: revoke any still-unrevoked rental_access tied to those intents (best-effort)
    let safetyRevokedCount = 0;
    if (pendingIntentIds.length > 0) {
      const { data: accessForIntents, error: accessForIntentsErr } = await supabase
        .from("rental_access")
        .select("id")
        .in("rental_intent_id", pendingIntentIds)
        .is("revoked_at", null);

      if (accessForIntentsErr) {
        console.warn("Safety access lookup failed:", accessForIntentsErr);
      } else {
        const safetyIds = (accessForIntents || []).map((r: { id: string }) => r.id);
        if (safetyIds.length > 0) {
          const { error: safetyRevokeErr } = await supabase
            .from("rental_access")
            .update({
              revoked_at: now,
              status: "failed",
              metadata: {
                expired_by: "rental-hard-reset:safety",
                expired_at: now,
              },
            })
            .in("id", safetyIds);

          if (safetyRevokeErr) {
            console.warn("Safety revoke failed:", safetyRevokeErr);
          } else {
            safetyRevokedCount = safetyIds.length;
          }
        }
      }
    }

    // Final audit log best-effort
    try {
      await logRentalStep(
        supabase,
        userId,
        contentId,
        normalizedType,
        {
          step: "validation",
          status: "success",
          message: `Hard reset complete. expired_access_revoked=${expiredAccessRevokedCount} pending_intents_failed=${pendingIntentsFailedCount} safety_revoked=${safetyRevokedCount}`,
          metadata: {
            expired_access_revoked: expiredAccessRevokedCount,
            pending_intents_failed: pendingIntentsFailedCount,
            safety_revoked: safetyRevokedCount,
            requested_by: requestedBy,
          },
          rentalIntentId: undefined,
          rentalAccessId: undefined,
        },
      );
    } catch {
      // ignore
    }

    return jsonResponse({
      success: true,
      input: { userId, contentId, contentType: normalizedType, maxAgeHoursPending },
      now,
      counts: {
        expired_accesses_revoked: expiredAccessRevokedCount,
        pending_intents_failed: pendingIntentsFailedCount,
        safety_revoked: safetyRevokedCount,
      },
    });
  } catch (error: unknown) {
    console.error("Rental hard-reset error:", error);
    return errorResponse("An unexpected error occurred", 500);
  }
});

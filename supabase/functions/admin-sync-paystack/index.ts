/// <reference path="../deno.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

import { fetchPaystackTransaction, syncPaymentRecord } from "../_shared/paystack-sync.ts";
import { normalizeContentType, type RentalContentType } from "../_shared/rental.ts";

type AllowedRole = "super_admin" | "accounting";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number) {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return errorResponse("Method not allowed", 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      return errorResponse("Server configuration error", 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return errorResponse("Unauthorized: missing bearer token", 401);

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: authUser, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser?.user) return errorResponse("Unauthorized", 401);

    const requestedBy = authUser.user.id;

    const { data: isAuthorized, error: roleErr } = await supabase.rpc("has_any_role", {
      _user_id: requestedBy,
      _roles: ["super_admin", "accounting"] as AllowedRole[],
    });

    if (roleErr || !isAuthorized) return errorResponse("Forbidden", 403);

    const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackKey) return errorResponse("PAYSTACK_SECRET_KEY not configured", 500);

    const body = await req.json().catch(() => ({})) as Partial<{
      limit: number;
    }>;

    const limit = typeof body.limit === "number" && body.limit > 0 ? Math.floor(body.limit) : 50;

    const { data: stalePaystackCount, error: stalePaystackError } = await supabase.rpc(
      "fail_stale_paystack_rental_intents",
      { p_age_minutes: 15 },
    );
    if (stalePaystackError) {
      console.warn("[admin-sync-paystack] stale Paystack cleanup failed:", stalePaystackError.message);
    } else if (Number(stalePaystackCount || 0) > 0) {
      console.log("[admin-sync-paystack] stale Paystack intents failed", { count: stalePaystackCount });
    }

    // Admin sync strategy:
    // - Use the canonical `payments` table where we have a paystack provider reference.
    // - Verify anything not yet completed/enhanced completed.
    const { data: candidateRows, error: candErr } = await supabase
      .from("payments")
      .select("id, user_id, purpose, amount, enhanced_status, status, provider_reference, metadata")
      .eq("provider", "paystack")
      .not("provider_reference", "is", null)
      .order("updated_at", { ascending: false })
      .limit(Math.min(limit * 3, 150));

    if (candErr) {
      console.error("[admin-sync-paystack] payments candidate query failed:", {
        code: candErr.code,
        message: candErr.message,
        details: candErr.details,
        hint: candErr.hint,
      });
      return errorResponse("Failed to query payments for sync", 500);
    }

    const paymentCandidates = (candidateRows ?? [])
      .filter((payment: any) => payment.enhanced_status !== "completed" || payment.status !== "completed");

    // Some historical/live-mode rental attempts have a rental_intent reference
    // but no usable payments.provider_reference row. Include those so the admin
    // Sync button can still repair/close stuck Paystack rentals.
    const { data: intentCandidates, error: intentCandErr } = await supabase
      .from("rental_intents")
      .select("id, user_id, status, price, provider_reference, paystack_reference, metadata, updated_at")
      .eq("payment_method", "paystack")
      .neq("status", "paid")
      .order("updated_at", { ascending: false })
      .limit(Math.min(limit * 3, 150));

    if (intentCandErr) {
      console.warn("[admin-sync-paystack] rental intent candidate query failed:", intentCandErr.message);
    }

    const byReference = new Map<string, any>();
    for (const payment of paymentCandidates) {
      if (payment.provider_reference) byReference.set(String(payment.provider_reference), { kind: "payment", payment });
    }
    for (const intent of intentCandidates ?? []) {
      const reference = String(intent.paystack_reference || intent.provider_reference || intent.id || "");
      if (reference && !byReference.has(reference)) byReference.set(reference, { kind: "intent", intent });
    }

    const candidates = Array.from(byReference.entries()).slice(0, limit).map(([reference, row]) => ({
      reference,
      payment: row.payment ?? null,
      seedIntent: row.intent ?? null,
    }));

    console.log("[admin-sync-paystack] candidate payments loaded", {
      fetched: candidateRows?.length ?? 0,
      fetched_intents: intentCandidates?.length ?? 0,
      selected: candidates.length,
      limit,
    });

    let synced = 0;
    let failures = 0;

    const anomalies: string[] = [];
    const perPayment: Array<{ payment_id: string; reference: string; status: string }> = [];

    const loadRentalIntentByReference = async (reference: string) => {
      const { data, error } = await supabase
        .from("rental_intents")
        .select("*")
        .or(`paystack_reference.eq.${reference},provider_reference.eq.${reference}`)
        .maybeSingle();
      if (error) return null;
      return (data ?? null) as any;
    };

    const loadActiveRentalAccess = async (
      rentalIntentId: string,
      userId: string,
      contentId: string,
      contentType: RentalContentType,
    ) => {
      const now = new Date().toISOString();

      const baseQuery = () =>
        supabase
          .from("rental_access")
          .select("*")
          .eq("user_id", userId)
          .is("revoked_at", null)
          .eq("status", "paid")
          .gt("expires_at", now)
          .order("expires_at", { ascending: false });

      const { data: byIntentRows, error: intentError } = await baseQuery()
        .eq("rental_intent_id", rentalIntentId)
        .limit(1);

      if (!intentError && byIntentRows?.[0]) return byIntentRows[0];

      const contentFields = {
        movie_id: contentType === "movie" ? contentId : null,
        season_id: contentType === "season" ? contentId : null,
        episode_id: contentType === "episode" ? contentId : null,
      };

      const { data: byContentRows, error: contentError } = await baseQuery()
        .or(
          [
            contentFields.movie_id ? `movie_id.eq.${contentFields.movie_id}` : null,
            contentFields.season_id ? `season_id.eq.${contentFields.season_id}` : null,
            contentFields.episode_id ? `episode_id.eq.${contentFields.episode_id}` : null,
          ]
            .filter(Boolean)
            .join(","),
        )
        .limit(1);

      if (!contentError && byContentRows?.[0]) return byContentRows[0];

      return null;
    };

    const grantRentalAccessLikeWebhook = async (
      rentalIntent: any,
      paymentChannel: string,
      paidAmount: number,
    ) => {
      const contentId = rentalIntent.movie_id || rentalIntent.season_id || rentalIntent.episode_id;
      if (!contentId) throw new Error("Missing rental content id");

      const existingAccess = await loadActiveRentalAccess(
        rentalIntent.id,
        rentalIntent.user_id,
        contentId,
        rentalIntent.rental_type,
      );
      if (existingAccess) return existingAccess;

      const { data: accessId, error } = await supabase.rpc("grant_rental_access", {
        p_user_id: rentalIntent.user_id,
        p_content_id: contentId,
        p_content_type: rentalIntent.rental_type,
        p_rental_type: rentalIntent.rental_type,
        p_expires_at:
          rentalIntent.expires_at ||
          new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        p_rental_intent_id: rentalIntent.id,
        p_source: "rental",
        p_metadata: {
          ...(rentalIntent.metadata || {}),
          payment_channel: paymentChannel,
          paystack_status: "success",
          amount_paid: paidAmount,
        },
      });

      if (error) return null;
      if (!accessId) return null;

      const { data, error: lookupErr } = await supabase
        .from("rental_access")
        .select("*")
        .eq("id", accessId)
        .maybeSingle();

      if (lookupErr || !data) return null;
      return data;
    };

    for (const candidate of candidates) {
      const reference = candidate.reference as string | null;
      if (!reference) continue;
      const payment = candidate.payment;

      try {
        console.log("[admin-sync-paystack] verifying payment", {
          payment_id: payment?.id ?? null,
          reference,
          enhanced_status: payment?.enhanced_status ?? null,
          status: payment?.status ?? candidate.seedIntent?.status ?? null,
        });

        const transaction = await fetchPaystackTransaction(reference, paystackKey);

        const paystackSuccess = transaction?.status === true;
        const paystackStatus = transaction?.data?.status || (paystackSuccess ? "success" : "failed");
        const paidAmount = Number(transaction?.data?.amount || 0);
        const channel = transaction?.data?.channel || "unknown";

        // Canonical payments update + wallet credit (topups) via shared logic
        await syncPaymentRecord(supabase, {
          reference,
          success: paystackSuccess && paystackStatus === "success",
          paidAmount,
          channel,
          paystackStatus,
          failureReason:
            paystackSuccess ? null : (transaction?.data?.failure_reason || transaction?.data?.failure_message || "Charge failed"),
          rawEvent: transaction?.data ?? {},
        });

        // If this is a rental payment, ensure rental intent/access are activated like webhook.
        const rentalIntent = (await loadRentalIntentByReference(reference)) || candidate.seedIntent;
        if (rentalIntent && paystackStatus === "success") {
          const expectedAmount = Math.round(Number(rentalIntent.price || 0));
          if (paidAmount < expectedAmount) {
            await supabase
              .from("rental_intents")
              .update({
                status: "failed",
                failed_at: new Date().toISOString(),
                metadata: {
                  ...(rentalIntent.metadata || {}),
                  error: "amount_mismatch",
                  received_amount: paidAmount,
                  expected_amount: expectedAmount,
                },
              })
              .eq("id", rentalIntent.id);
            console.warn("[admin-sync-paystack] amount mismatch", {
                payment_id: payment?.id ?? "intent-only",
              rental_intent_id: rentalIntent.id,
              reference,
              paidAmount,
              expectedAmount,
            });
            anomalies.push(`amount_mismatch: payment=${payment?.id ?? "intent-only"} ref=${reference}`);
            perPayment.push({ payment_id: String(payment?.id ?? rentalIntent.id), reference, status: "amount_mismatch" });
            continue;
          }

          const now = new Date().toISOString();
          if (rentalIntent.status !== "paid") {
            await supabase
              .from("rental_intents")
              .update({
                status: "paid",
                paid_at: now,
                paystack_reference: reference,
                provider_reference: reference,
                metadata: {
                  ...(rentalIntent.metadata || {}),
                  payment_channel: channel,
                  paystack_status: paystackStatus,
                  amount_paid: paidAmount,
                  fees_charged: Math.max(paidAmount - expectedAmount, 0),
                },
              })
              .eq("id", rentalIntent.id);
            console.log("[admin-sync-paystack] rental intent marked paid", {
              rental_intent_id: rentalIntent.id,
              reference,
              paidAmount,
            });
          }

          const contentId = rentalIntent.movie_id || rentalIntent.season_id || rentalIntent.episode_id;
          if (contentId) {
            await grantRentalAccessLikeWebhook(rentalIntent, channel, paidAmount);
          }
        } else if (rentalIntent && ["failed", "abandoned", "cancelled", "canceled", "reversed"].includes(String(paystackStatus).toLowerCase())) {
          await supabase
            .from("rental_intents")
            .update({
              status: "failed",
              failed_at: new Date().toISOString(),
              metadata: {
                ...(rentalIntent.metadata || {}),
                paystack_status: paystackStatus,
                failure_reason: transaction?.data?.gateway_response || transaction?.data?.message || "Payment not completed",
                synced_by: "admin-sync-paystack",
              },
            })
            .eq("id", rentalIntent.id);
        }

        synced += 1;
        perPayment.push({ payment_id: String(payment?.id ?? rentalIntent?.id ?? "intent-only"), reference, status: "synced" });
      } catch (e: any) {
        failures += 1;
        anomalies.push(`payment_failed: payment=${payment?.id ?? "intent-only"} ref=${reference} err=${String(e?.message || e)}`);
        perPayment.push({ payment_id: String(payment?.id ?? candidate.seedIntent?.id ?? "intent-only"), reference: String(reference), status: "error" });
      }
    }

    return jsonResponse({
      success: true,
      counts: {
        attempted: (candidates ?? []).length,
        synced,
        failures,
      },
      anomalies_count: anomalies.length,
      anomalies: anomalies.slice(0, 20),
      per_payment: perPayment.slice(0, 10),
    });
  } catch (error: any) {
    console.error("admin-sync-paystack error:", error);
    return errorResponse("Admin sync failed", 500);
  }
});

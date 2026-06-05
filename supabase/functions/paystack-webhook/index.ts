/// <reference path="../deno.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

import { normalizeContentType, type RentalContentType } from "../_shared/rental.ts";

interface RentalIntentRow {
  id: string;
  user_id: string;
  movie_id: string | null;
  season_id: string | null;
  episode_id: string | null;
  rental_type: RentalContentType;
  status: string;
  price: number | null;
  currency: string | null;
  payment_method: string | null;
  provider_reference: string | null;
  paystack_reference: string | null;
  expires_at: string | null;
  paid_at: string | null;
  failed_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface RentalAccessRow {
  id: string;
  user_id: string;
  movie_id: string | null;
  season_id: string | null;
  episode_id: string | null;
  rental_type: RentalContentType;
  status: string;
  expires_at: string;
  revoked_at: string | null;
  rental_intent_id: string | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
}

function buildContentFields(contentId: string, contentType: RentalContentType) {
  return {
    movie_id: contentType === "movie" ? contentId : null,
    season_id: contentType === "season" ? contentId : null,
    episode_id: contentType === "episode" ? contentId : null,
  };
}

/**
 * Sync the canonical `payments` row for a Paystack reference so the admin
 * dashboard reflects every Paystack event (rental + wallet_topup), and credit
 * the wallet exactly once when a wallet top-up succeeds. Safe to call multiple
 * times — idempotent on `enhanced_status`.
 */
async function syncPaymentRecord(
  supabase: ReturnType<typeof createClient>,
  params: {
    reference: string;
    success: boolean;
    paidAmount: number;
    channel: string;
    paystackStatus: string;
    failureReason?: string | null;
    rawEvent: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const { data: payment, error: lookupErr } = await supabase
      .from("payments")
      .select("id, user_id, purpose, amount, enhanced_status, status, metadata")
      .or(`intent_id.eq.${params.reference},provider_reference.eq.${params.reference}`)
      .maybeSingle();

    if (lookupErr) {
      console.warn("[webhook] payment lookup failed:", lookupErr.message);
      return;
    }
    if (!payment) {
      console.log("[webhook] no payment row for reference:", params.reference);
      return;
    }

    const alreadyCompleted =
      payment.enhanced_status === "completed" || payment.status === "completed";

    const nextStatus = params.success ? "completed" : "failed";
    const nextEnhanced = params.success ? "completed" : "failed";

    const mergedMeta = {
      ...(payment.metadata as Record<string, unknown> | null ?? {}),
      paystack_channel: params.channel,
      paystack_status: params.paystackStatus,
      paystack_paid_amount: params.paidAmount,
      paystack_event_at: new Date().toISOString(),
      ...(params.failureReason ? { paystack_failure_reason: params.failureReason } : {}),
    };

    const { error: updErr } = await supabase
      .from("payments")
      .update({
        status: nextStatus,
        enhanced_status: nextEnhanced,
        provider_reference: params.reference,
        method: params.channel,
        error_message: params.success ? null : (params.failureReason ?? "Charge failed"),
        metadata: mergedMeta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (updErr) {
      console.warn("[webhook] payment update failed:", updErr.message);
    }

    // Credit wallet for top-ups — only if not already completed.
    if (params.success && payment.purpose === "wallet_topup" && !alreadyCompleted) {
      const { data: wallet, error: walletErr } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", payment.user_id)
        .maybeSingle();

      let walletId = wallet?.id as string | undefined;
      if (!walletId) {
        const { data: newWalletId } = await supabase.rpc("ensure_wallet_for_user", {
          p_user_id: payment.user_id,
        });
        walletId = newWalletId as string | undefined;
      }

      if (!walletId) {
        console.error("[webhook] wallet not found and could not be created for", payment.user_id);
        return;
      }

      const { error: creditErr } = await supabase.rpc("credit_wallet", {
        p_wallet_id: walletId,
        p_amount: params.paidAmount,
        p_type: "wallet_topup",
        p_reference: params.reference,
        p_description: "Paystack wallet top-up",
        p_metadata: { channel: params.channel, source: "paystack-webhook" },
        p_user_id: payment.user_id,
        p_payment_id: payment.id,
      });

      if (creditErr) {
        // Wallet ledger uses unique constraint on reference for idempotency — duplicate is OK.
        const msg = String(creditErr.message || "");
        if (creditErr.code === "23505" || /duplicate|already/i.test(msg)) {
          console.log("[webhook] wallet credit already applied for", params.reference);
        } else {
          console.error("[webhook] wallet credit failed:", msg);
        }
      } else {
        console.log(
          `[webhook] wallet credited: user=${payment.user_id} amount=${params.paidAmount} ref=${params.reference}`,
        );
      }
    }
  } catch (err) {
    console.error("[webhook] syncPaymentRecord exception:", err);
  }
}

async function verifyPaystackSignature(payload: string, signature: string): Promise<boolean> {
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secret) {
    console.error("Paystack secret key not found");
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return computedSignature === signature;
}

async function loadRentalIntentByReference(supabase: ReturnType<typeof createClient>, reference: string) {
  const { data, error } = await supabase
    .from("rental_intents")
    .select("*")
    .or(`paystack_reference.eq.${reference},provider_reference.eq.${reference}`)
    .maybeSingle();

  if (error) {
    console.error("Rental intent lookup error:", error);
    return null;
  }

  return (data as RentalIntentRow | null) ?? null;
}

async function loadActiveRentalAccess(
  supabase: ReturnType<typeof createClient>,
  rentalIntentId: string,
  userId: string,
  contentId: string,
  contentType: RentalContentType,
): Promise<RentalAccessRow | null> {
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

  const { data: byIntent, error: intentError } = await baseQuery()
    .eq("rental_intent_id", rentalIntentId)
    .maybeSingle();
  if (!intentError && byIntent) {
    return byIntent as RentalAccessRow;
  }

  const fields = buildContentFields(contentId, contentType);

  const { data: byContent, error: contentError } = await baseQuery()
    .or(
      [
        fields.movie_id ? `movie_id.eq.${fields.movie_id}` : null,
        fields.season_id ? `season_id.eq.${fields.season_id}` : null,
        fields.episode_id ? `episode_id.eq.${fields.episode_id}` : null,
      ]
        .filter(Boolean)
        .join(","),
    )
    .maybeSingle();

  if (!contentError && byContent) {
    return byContent as RentalAccessRow;
  }

  return null;
}

async function grantRentalAccess(
  supabase: ReturnType<typeof createClient>,
  rentalIntent: RentalIntentRow,
  paymentChannel: string,
  paidAmount: number,
) {
  const contentId = rentalIntent.movie_id || rentalIntent.season_id || rentalIntent.episode_id;
  if (!contentId) {
    throw new Error("Missing rental content id");
  }

  const existingAccess = await loadActiveRentalAccess(
    supabase,
    rentalIntent.id,
    rentalIntent.user_id,
    contentId,
    rentalIntent.rental_type,
  );

  if (existingAccess) {
    return existingAccess;
  }

  const { data: accessId, error } = await supabase.rpc("grant_rental_access", {
    p_user_id: rentalIntent.user_id,
    p_content_id: contentId,
    p_content_type: rentalIntent.rental_type,
    p_rental_type: rentalIntent.rental_type,
    p_expires_at: rentalIntent.expires_at || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    p_rental_intent_id: rentalIntent.id,
    p_source: "rental",
    p_metadata: {
      ...(rentalIntent.metadata || {}),
      payment_channel: paymentChannel,
      paystack_status: "success",
      amount_paid: paidAmount,
    },
  });

  if (error) {
    console.error("Access grant error:", error);
    return null;
  }

  if (!accessId) return null;

  const { data, error: accessLookupError } = await supabase
    .from("rental_access")
    .select("*")
    .eq("id", accessId)
    .maybeSingle();

  if (accessLookupError || !data) {
    return null;
  }

  return data as RentalAccessRow;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing Paystack signature" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const body = await req.text();

    const isValid = await verifyPaystackSignature(body, signature);
    if (!isValid) {
      console.error("Invalid Paystack signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const event = JSON.parse(body);
    console.log("Webhook event:", event.event, "Reference:", event.data?.reference);

    if (event.event === "charge.success") {
      const paymentReference = event.data?.reference;
      const paymentChannel = event.data?.channel || "unknown";
      const paymentStatus = event.data?.status || "success";
      const paidAmount = Number(event.data?.amount || 0);

      if (!paymentReference) {
        return new Response(JSON.stringify({ received: true, message: "Missing payment reference" }), {
          headers: corsHeaders,
        });
      }

      const rentalIntent = await loadRentalIntentByReference(supabase, paymentReference);
      if (!rentalIntent) {
        console.error("Rental intent not found for reference:", paymentReference);
        return new Response(JSON.stringify({ received: true, message: "Intent not found" }), {
          headers: corsHeaders,
        });
      }

      const expectedAmount = Math.round(Number(rentalIntent.price || 0));
      if (paidAmount < expectedAmount) {
        console.log(`[Webhook Amount Check] Reference: ${paymentReference}`);
        console.log(`  - Paystack paid amount: ${paidAmount}`);
        console.log(`  - Rental intent price: ${rentalIntent.price}`);
        console.log(`  - Expected amount: ${expectedAmount}`);
        console.log(
          `  - Amount check result: ${paidAmount >= expectedAmount ? "PASS ✅" : "FAIL ❌"}`,
        );

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

        return new Response(JSON.stringify({ received: true, message: "Amount mismatch" }), {
          headers: corsHeaders,
        });
      }

      const now = new Date().toISOString();
      if (rentalIntent.status !== "paid") {
        const { error: intentUpdateError } = await supabase
          .from("rental_intents")
          .update({
            status: "paid",
            paid_at: now,
            paystack_reference: paymentReference,
            provider_reference: paymentReference,
            metadata: {
              ...(rentalIntent.metadata || {}),
              payment_channel: paymentChannel,
              paystack_status: paymentStatus,
              amount_paid: paidAmount,
              fees_charged: Math.max(paidAmount - expectedAmount, 0),
            },
          })
          .eq("id", rentalIntent.id);

        if (intentUpdateError) {
          console.error("Intent update error:", intentUpdateError);
          return new Response(
            JSON.stringify({
              received: true,
              message: "Payment verified but intent update failed",
            }),
            { headers: corsHeaders },
          );
        }
      }

      const contentId = rentalIntent.movie_id || rentalIntent.season_id || rentalIntent.episode_id;
      if (!contentId) {
        return new Response(JSON.stringify({ received: true, message: "Missing content id" }), {
          headers: corsHeaders,
        });
      }

      const activeAccess = await loadActiveRentalAccess(
        supabase,
        rentalIntent.id,
        rentalIntent.user_id,
        contentId,
        rentalIntent.rental_type,
      );

      if (activeAccess) {
        console.log(
          `✅ Payment confirmed and rental access already exists: intent_id=${rentalIntent.id}, access_id=${activeAccess.id}, channel=${paymentChannel}`,
        );

        return new Response(
          JSON.stringify({
            received: true,
            message: "Rental already activated",
            rental_intent_id: rentalIntent.id,
            rental_access_id: activeAccess.id,
            channel: paymentChannel,
          }),
          { headers: corsHeaders },
        );
      }

      const accessRow = await grantRentalAccess(supabase, rentalIntent, paymentChannel, paidAmount);
      if (!accessRow) {
        console.error("Access grant failed for intent:", rentalIntent.id);
        return new Response(
          JSON.stringify({
            received: true,
            message: "Payment confirmed but access grant failed",
          }),
          { headers: corsHeaders },
        );
      }

      // PHASE 7: LEGACY CLEANUP
      // Do NOT mirror to legacy `rentals` table anymore.
      // All access grants now go to canonical rental_access table.
      // Legacy table is read-only for backward compatibility during deprecation window.
      console.log(
        `✅ Payment confirmed and rental access granted: intent_id=${rentalIntent.id}, access_id=${accessRow.id}, channel=${paymentChannel}, (skipped legacy rental mirror)`
      );

      return new Response(
        JSON.stringify({
          received: true,
          message: "Rental activated",
          rental_intent_id: rentalIntent.id,
          rental_access_id: accessRow.id,
          channel: paymentChannel,
        }),
        { headers: corsHeaders },
      );
    }

    if (event.event === "charge.dispute.create") {
      console.warn("Charge dispute created:", event.data?.reference);

      const paymentReference = event.data?.reference;
      if (!paymentReference) {
        return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
      }

      const rentalIntent = await loadRentalIntentByReference(supabase, paymentReference);
      if (rentalIntent) {
        await supabase
          .from("rental_intents")
          .update({
            metadata: {
              ...(rentalIntent.metadata || {}),
              dispute_status: "disputed",
              dispute_reason: event.data?.reason,
              dispute_amount: event.data?.amount,
            },
          })
          .eq("id", rentalIntent.id);

        await supabase
          .from("rental_access")
          .update({
            revoked_at: new Date().toISOString(),
            status: "revoked",
          })
          .eq("rental_intent_id", rentalIntent.id)
          .is("revoked_at", null);
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: corsHeaders,
      });
    }

    if (event.event === "charge.failed") {
      console.warn("Charge failed event:", event.data?.reference);

      const paymentReference = event.data?.reference;
      if (!paymentReference) {
        return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
      }

      const rentalIntent = await loadRentalIntentByReference(supabase, paymentReference);
      if (rentalIntent && rentalIntent.status === "pending") {
        await supabase
          .from("rental_intents")
          .update({
            status: "failed",
            failed_at: new Date().toISOString(),
            metadata: {
              ...(rentalIntent.metadata || {}),
              failure_reason: event.data?.failure_reason || "Unknown",
              failure_message: event.data?.failure_message || "",
            },
          })
          .eq("id", rentalIntent.id);
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

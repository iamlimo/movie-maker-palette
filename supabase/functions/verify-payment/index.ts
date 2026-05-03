/// <reference path="../deno.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, jsonResponse, handleOptions, errorResponse } from "../_shared/cors.ts";
import { authenticateUser } from "../_shared/auth.ts";

type RentalContentType = "movie" | "season" | "episode";
type PaymentStatus = "completed" | "pending" | "failed" | "cancelled" | "unknown";

interface RequestIdentifiers {
  paymentId: string | null;
  reference: string | null;
  rentalIntentId: string | null;
  rentalId: string | null;
}

interface PaymentRow {
  id: string;
  user_id: string;
  purpose: string | null;
  provider: string | null;
  provider_reference: string | null;
  enhanced_status: string | null;
  status: string | null;
  amount: number | null;
  metadata: Record<string, unknown> | null;
  created_at?: string;
}

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
  created_at?: string;
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

interface RentalSummary {
  id: string;
  status: string;
  expiresAt: string;
}

function buildRentalSummary(record: { id: string; status: string; expires_at?: string | null; expiresAt?: string | null } | null): RentalSummary | null {
  if (!record) return null;

  return {
    id: record.id,
    status: record.status,
    expiresAt: record.expiresAt || record.expires_at || "",
  };
}

function normalizeContentType(contentType: unknown): RentalContentType {
  const value = String(contentType || "").toLowerCase().trim();

  if (value === "season" || value === "episode") return value;
  if (value === "tv" || value === "tv_show") return "season";
  return "movie";
}

function normalizePaymentStatus(status: string | null | undefined): PaymentStatus {
  const value = String(status || "").toLowerCase().trim();

  if (["completed", "success", "successful", "paid"].includes(value)) return "completed";
  if (["failed", "error", "declined", "rejected"].includes(value)) return "failed";
  if (["cancelled", "canceled"].includes(value)) return "cancelled";
  if (["pending", "processing", "initiated", "abandoned"].includes(value)) return "pending";
  return "unknown";
}

function extractIdentifiers(url: URL, body: Record<string, unknown> = {}): RequestIdentifiers {
  const paymentId = (url.searchParams.get("payment_id") || body.payment_id || null) as string | null;
  const reference = (url.searchParams.get("reference") || body.reference || null) as string | null;
  const rentalIntentId = (url.searchParams.get("rental_intent_id") || body.rental_intent_id || body.rentalId || null) as string | null;
  const rentalId = (url.searchParams.get("rental_id") || body.rental_id || body.rentalId || null) as string | null;

  return { paymentId, reference, rentalIntentId, rentalId };
}

function extractContentInfo(intent: RentalIntentRow | null, payment: PaymentRow | null) {
  const metadata = (intent?.metadata || payment?.metadata || {}) as Record<string, unknown>;

  const contentId =
    intent?.movie_id ||
    intent?.season_id ||
    intent?.episode_id ||
    (metadata.content_id as string | undefined) ||
    null;

  const contentType = intent?.rental_type
    ? intent.rental_type
    : normalizeContentType(metadata.content_type);

  return {
    contentId,
    contentType,
  };
}

async function hasRole(supabase: any, userId: string, role: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();

  return !!data && !error;
}

async function loadPayment(supabase: any, paymentId: string | null, reference: string | null): Promise<PaymentRow | null> {
  if (!paymentId && !reference) return null;

  let query = supabase.from("payments").select("*");

  if (paymentId) {
    query = query.eq("id", paymentId);
  } else if (reference) {
    query = query.or(`provider_reference.eq.${reference},intent_id.eq.${reference}`);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("Payment lookup error:", error);
    return null;
  }

  return (data as PaymentRow | null) ?? null;
}

async function loadRentalIntent(
  supabase: any,
  identifiers: RequestIdentifiers,
  payment: PaymentRow | null,
): Promise<RentalIntentRow | null> {
  const candidateIds = [identifiers.rentalIntentId, identifiers.rentalId].filter(Boolean) as string[];

  for (const candidateId of candidateIds) {
    const { data, error } = await supabase
      .from("rental_intents")
      .select("*")
      .eq("id", candidateId)
      .maybeSingle();

    if (!error && data) return data as RentalIntentRow;
  }

  const references = [identifiers.reference, payment?.provider_reference].filter(Boolean) as string[];

  for (const candidateReference of references) {
    const { data, error } = await supabase
      .from("rental_intents")
      .select("*")
      .or(`provider_reference.eq.${candidateReference},paystack_reference.eq.${candidateReference}`)
      .maybeSingle();

    if (!error && data) return data as RentalIntentRow;
  }

  if (payment?.metadata) {
    const rentalIntentId = payment.metadata.rental_intent_id as string | undefined;
    if (rentalIntentId) {
      const { data, error } = await supabase
        .from("rental_intents")
        .select("*")
        .eq("id", rentalIntentId)
        .maybeSingle();

      if (!error && data) return data as RentalIntentRow;
    }
  }

  return null;
}

async function loadActiveRentalAccess(
  supabase: any,
  userId: string,
  contentId: string | null,
  contentType: RentalContentType,
  intentId: string | null,
): Promise<RentalAccessRow | null> {
  let query = supabase
    .from("rental_access")
    .select("*")
    .eq("user_id", userId)
    .eq("revoked_at", null)
    .eq("status", "paid")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false });

  if (intentId) {
    const { data, error } = await query.eq("rental_intent_id", intentId).maybeSingle();
    if (!error && data) return data as RentalAccessRow;
  }

  if (contentId) {
    if (contentType === "movie") {
      const { data, error } = await query.eq("movie_id", contentId).maybeSingle();
      if (!error && data) return data as RentalAccessRow;
    }

    if (contentType === "season") {
      const { data, error } = await query.eq("season_id", contentId).maybeSingle();
      if (!error && data) return data as RentalAccessRow;
    }

    if (contentType === "episode") {
      const { data, error } = await query.eq("episode_id", contentId).maybeSingle();
      if (!error && data) return data as RentalAccessRow;
    }
  }

  return null;
}

async function verifyWithPaystack(reference: string) {
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!paystackSecretKey) return null;

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${paystackSecretKey}` },
    });

    if (!response.ok) return null;

    const payload = await response.json();
    return payload?.data ?? null;
  } catch (error) {
    console.error("Paystack verification error:", error);
    return null;
  }
}

async function grantAccessIfNeeded(
  supabase: any,
  intent: RentalIntentRow,
  payment: PaymentRow | null,
): Promise<RentalAccessRow | null> {
  const contentInfo = extractContentInfo(intent, payment);
  if (!contentInfo.contentId) return null;

  const existingAccess = await loadActiveRentalAccess(
    supabase,
    intent.user_id,
    contentInfo.contentId,
    contentInfo.contentType,
    intent.id,
  );

  if (existingAccess) return existingAccess;

  const { data: grantedAccessId, error } = await supabase.rpc("grant_rental_access", {
    p_user_id: intent.user_id,
    p_content_id: contentInfo.contentId,
    p_content_type: contentInfo.contentType,
    p_rental_type: intent.rental_type,
    p_expires_at: intent.expires_at || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    p_rental_intent_id: intent.id,
    p_source: "rental",
    p_metadata: intent.metadata || {},
  });

  if (error) {
    console.error("Grant access RPC error:", error);
    return null;
  }

  if (!grantedAccessId) return null;

  const { data, error: accessError } = await supabase
    .from("rental_access")
    .select("*")
    .eq("id", grantedAccessId)
    .maybeSingle();

  if (accessError || !data) return null;
  return data as RentalAccessRow;
}

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const { user, supabase } = await authenticateUser(req);

    const url = new URL(req.url);
    let body: Record<string, unknown> = {};

    if (req.method !== "GET") {
      try {
        body = await req.clone().json();
      } catch (_) {
        body = {};
      }
    }

    const identifiers = extractIdentifiers(url, body);

    if (!identifiers.paymentId && !identifiers.reference && !identifiers.rentalIntentId && !identifiers.rentalId) {
      return errorResponse("payment_id, reference, or rental_intent_id is required", 400);
    }

    const payment = await loadPayment(supabase, identifiers.paymentId, identifiers.reference);
    const rentalIntent = await loadRentalIntent(supabase, identifiers, payment);

    if (!payment && !rentalIntent) {
      return errorResponse("Payment or rental intent not found", 404);
    }

    const ownerId = rentalIntent?.user_id || payment?.user_id || null;
    const isAdmin = await hasRole(supabase, user.id, "admin");
    const isSuperAdmin = await hasRole(supabase, user.id, "super_admin");

    if (ownerId && ownerId !== user.id && !isAdmin && !isSuperAdmin) {
      return errorResponse("Access denied", 403);
    }

    const intentStatus = rentalIntent ? normalizePaymentStatus(rentalIntent.status) : null;
    const paymentStatus = payment
      ? normalizePaymentStatus(payment.enhanced_status || payment.status)
      : null;

    const contentInfo = extractContentInfo(rentalIntent, payment);
    const activeAccess = rentalIntent
      ? await loadActiveRentalAccess(
          supabase,
          rentalIntent.user_id,
          contentInfo.contentId,
          contentInfo.contentType,
          rentalIntent.id,
        )
      : null;

    if (activeAccess) {
      return jsonResponse({
        success: true,
        payment: payment
          ? {
              id: payment.id,
              channel: payment.provider,
              status: paymentStatus || "completed",
              message: "Active rental access found",
              enhanced_status: payment.enhanced_status,
              provider_reference: payment.provider_reference,
            }
          : null,
        rental: buildRentalSummary(activeAccess),
        related_records: {
          rental_access: [activeAccess],
        },
        message: "Rental access is active",
      });
    }

    const referenceToVerify =
      rentalIntent?.paystack_reference ||
      rentalIntent?.provider_reference ||
      payment?.provider_reference ||
      identifiers.reference ||
      null;

    const shouldVerifyWithPaystack =
      (rentalIntent?.payment_method === "paystack" || payment?.provider === "paystack") &&
      referenceToVerify &&
      intentStatus !== "completed";

    let paystackResult: Record<string, unknown> | null = null;
    if (shouldVerifyWithPaystack) {
      paystackResult = await verifyWithPaystack(referenceToVerify);
    }

    const paystackStatus = String((paystackResult?.status as string | undefined) || "").toLowerCase();
    const paystackSuccessful = ["success", "successful", "completed", "paid"].includes(paystackStatus);
    const paystackFailed = ["failed", "abandoned", "cancelled", "canceled", "reversed"].includes(paystackStatus);

    if (rentalIntent && paystackSuccessful && intentStatus !== "completed") {
      const now = new Date().toISOString();

      await supabase
        .from("rental_intents")
        .update({
          status: "paid",
          paid_at: now,
          provider_reference: referenceToVerify,
          paystack_reference: referenceToVerify,
          updated_at: now,
        })
        .eq("id", rentalIntent.id);

      if (payment) {
        await supabase
          .from("payments")
          .update({
            enhanced_status: "completed",
            status: "completed",
            provider_reference: referenceToVerify,
          })
          .eq("id", payment.id);
      }

      const grantedAccess = await grantAccessIfNeeded(supabase, rentalIntent, payment);

      return jsonResponse({
        success: true,
        payment: {
          id: payment?.id || rentalIntent.id,
          channel: rentalIntent.payment_method || payment?.provider || "paystack",
          status: "completed",
          message: "Payment verified and access granted",
          enhanced_status: "completed",
          provider_reference: referenceToVerify,
        },
        rental: buildRentalSummary(grantedAccess),
        related_records: {
          rental_access: grantedAccess ? [grantedAccess] : [],
        },
      });
    }

    if (rentalIntent && paystackFailed && intentStatus !== "failed") {
      const now = new Date().toISOString();

      await supabase
        .from("rental_intents")
        .update({
          status: "failed",
          failed_at: now,
          updated_at: now,
        })
        .eq("id", rentalIntent.id);

      if (payment) {
        await supabase
          .from("payments")
          .update({
            enhanced_status: "failed",
            status: "failed",
            provider_reference: referenceToVerify,
          })
          .eq("id", payment.id);
      }

      return jsonResponse({
        success: false,
        payment: {
          id: payment?.id || rentalIntent.id,
          channel: rentalIntent.payment_method || payment?.provider || "paystack",
          status: "failed",
          message: "Payment failed or was cancelled",
          enhanced_status: "failed",
          provider_reference: referenceToVerify,
        },
        rental: null,
        message: "Payment failed or was cancelled",
      });
    }

    if (rentalIntent && intentStatus === "completed") {
      const grantedAccess = await grantAccessIfNeeded(supabase, rentalIntent, payment);

      return jsonResponse({
        success: true,
        payment: {
          id: payment?.id || rentalIntent.id,
          channel: rentalIntent.payment_method || payment?.provider || "rental",
          status: "completed",
          message: "Rental intent already completed",
          enhanced_status: "completed",
          provider_reference: rentalIntent.provider_reference || payment?.provider_reference,
        },
        rental: buildRentalSummary(grantedAccess || rentalIntent),
        related_records: {
          rental_access: grantedAccess ? [grantedAccess] : [],
        },
      });
    }

    if (paymentStatus === "completed" && payment) {
      return jsonResponse({
        success: true,
        payment: {
          id: payment.id,
          channel: payment.provider,
          status: "completed",
          message: "Payment completed",
          enhanced_status: payment.enhanced_status,
          provider_reference: payment.provider_reference,
        },
        rental: null,
        related_records: null,
      });
    }

    const status: PaymentStatus = paystackFailed
      ? "failed"
      : paystackSuccessful
        ? "completed"
        : paymentStatus === "failed"
          ? "failed"
          : paymentStatus === "pending" || intentStatus === "pending"
            ? "pending"
            : "unknown";

    return jsonResponse({
      success: status === "completed",
      payment: payment
        ? {
            id: payment.id,
            channel: payment.provider,
            status: paymentStatus || "unknown",
            message: "Payment lookup completed",
            enhanced_status: payment.enhanced_status,
            provider_reference: payment.provider_reference,
          }
        : rentalIntent
          ? {
              id: rentalIntent.id,
              channel: rentalIntent.payment_method,
              status: intentStatus || "unknown",
              message: "Rental intent lookup completed",
              enhanced_status: rentalIntent.status,
              provider_reference: rentalIntent.provider_reference || rentalIntent.paystack_reference,
            }
          : null,
      rental: buildRentalSummary(activeAccess || rentalIntent),
      related_records: activeAccess ? { rental_access: [activeAccess] } : null,
      message:
        status === "pending"
          ? "Payment is still being processed"
          : status === "failed"
            ? "Payment failed"
            : "Payment status unknown",
    });
  } catch (error: unknown) {
    console.error("Error in verify-payment:", error);
    return errorResponse("An unexpected error occurred", 500);
  }
});

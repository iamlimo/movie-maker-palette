import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, jsonResponse, handleOptions, errorResponse } from "../_shared/cors.ts";
import { authenticateUser } from "../_shared/auth.ts";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
};

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

    // Legacy payments stored the rental_intent uuid in payments.intent_id
    const intentId = (payment as PaymentRow & { intent_id?: string }).intent_id;
    if (intentId) {
      const { data, error } = await supabase
        .from("rental_intents")
        .select("*")
        .eq("id", intentId)
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
  const baseQuery = () =>
    supabase
      .from("rental_access")
      .select("*")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .eq("status", "paid")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false });

  if (intentId) {
    const { data, error } = await baseQuery().eq("rental_intent_id", intentId).maybeSingle();
    if (!error && data) return data as RentalAccessRow;
  }

  if (contentId) {
    if (contentType === "movie") {
      const { data, error } = await baseQuery().eq("movie_id", contentId).maybeSingle();
      if (!error && data) return data as RentalAccessRow;
    }

    if (contentType === "season") {
      const { data, error } = await baseQuery().eq("season_id", contentId).maybeSingle();
      if (!error && data) return data as RentalAccessRow;
    }

    if (contentType === "episode") {
      const { data, error } = await baseQuery().eq("episode_id", contentId).maybeSingle();
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
  // Clean architecture rebuild rule (Full Reset: B):
  // verify-payment must be READ-ONLY for entitlement.
  // Webhook (paystack-webhook) / wallet RPC are the only writers.
  const contentInfo = extractContentInfo(intent, payment);
  if (!contentInfo.contentId) return null;

  return await loadActiveRentalAccess(
    supabase,
    intent.user_id,
    contentInfo.contentId,
    contentInfo.contentType,
    intent.id,
  );
}

serve(async (req: Request) => {
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

    let intentStatus = rentalIntent ? normalizePaymentStatus(rentalIntent.status) : null;
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
      
      if (!paystackResult) {
        console.warn(
          `⚠️  Paystack API verification returned null for reference: ${referenceToVerify}. Will rely on webhook + intent status.`
        );
      } else {
        console.log(`✅ Paystack API verification succeeded: status=${paystackResult?.status}`);
      }
    }

    // CRITICAL: Re-fetch rental_intent to catch webhook updates that may have arrived
    // This handles the race condition where webhook updates the status between our initial load and Paystack verification
    let refreshedRentalIntent = rentalIntent;
    if (rentalIntent && shouldVerifyWithPaystack) {
      const { data: refreshedIntent, error: refreshError } = await supabase
        .from("rental_intents")
        .select("*")
        .eq("id", rentalIntent.id)
        .maybeSingle();

      if (!refreshError && refreshedIntent) {
        refreshedRentalIntent = refreshedIntent as RentalIntentRow;
        const freshStatus = normalizePaymentStatus(refreshedRentalIntent.status);
        
        // Log if status changed (indicates webhook has processed)
        if (freshStatus !== intentStatus) {
          console.log(
            `🔄 Webhook update detected: rental_intent status changed from "${intentStatus}" to "${freshStatus}" (raw: ${refreshedRentalIntent.status})`
          );
        }
        
        // Re-calculate intentStatus with refreshed data
        intentStatus = freshStatus;
      }
    }

    const paystackStatus = String((paystackResult?.status as string | undefined) || "").toLowerCase();
    const paystackSuccessful = ["success", "successful", "completed", "paid"].includes(paystackStatus);
    const paystackFailed = ["failed", "abandoned", "cancelled", "canceled", "reversed"].includes(paystackStatus);

    // Log cancelled/failed payments for debugging
    if (paystackFailed) {
      console.warn(`❌ Payment cancelled/failed: reference=${referenceToVerify}, status=${paystackStatus}`);
    }

    // Full Reset (B) rule: verify-payment must be READ-ONLY.
    // It must NOT update rental_intents/payments or grant entitlement.
    // Webhook (paystack-webhook) is the only authoritative writer.

    // If webhook already granted access, it will be visible via loadActiveRentalAccess above.
    // We still compute a status summary for the UI.

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
        : rentalIntent && refreshedRentalIntent
          ? {
              id: refreshedRentalIntent.id,
              channel: refreshedRentalIntent.payment_method,
              status: intentStatus || "unknown",
              message: "Rental intent lookup completed",
              enhanced_status: refreshedRentalIntent.status,
              provider_reference:
                refreshedRentalIntent.provider_reference || refreshedRentalIntent.paystack_reference,
            }
          : null,
      rental: buildRentalSummary(activeAccess || refreshedRentalIntent),
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

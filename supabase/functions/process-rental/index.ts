/// <reference path="../deno.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { normalizeContentType, getDefaultRentalDurationHours, type RentalContentType } from "../_shared/rental.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";

const ALLOWED_ORIGINS = [
  "https://signaturetv.co",
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

function getCorsHeaders(origin?: string): Record<string, string> {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin || "")
    ? (origin || "https://signaturetv.co")
    : "https://signaturetv.co";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
    "Content-Type": "application/json",
  };
}

function createResponse(data: unknown, status = 200, origin?: string) {
  return new Response(JSON.stringify(data), { status, headers: getCorsHeaders(origin) });
}

interface ProcessRentalRequest {
  userId: string;
  contentId: string;
  contentType: "movie" | "episode" | "season";
  price: number;
  paymentMethod: "wallet" | "paystack";
  referralCode?: string;
}

interface ReferralCodeRow {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  valid_until: string | null;
  max_uses: number | null;
  times_used: number;
  min_purchase_amount: number;
  max_uses_per_user: number;
}

interface WalletRow {
  wallet_id: string;
  balance: number;
  user_id: string | null;
}

function buildExpiryAt(contentType: RentalContentType, expiryHours: number) {
  return new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
}

async function getRentalExpiryHours(
  supabase: ReturnType<typeof createClient>,
  contentId: string,
  contentType: RentalContentType,
): Promise<number> {
  try {
    if (contentType === "movie") {
      const { data } = await supabase
        .from("movies")
        .select("rental_expiry_duration")
        .eq("id", contentId)
        .maybeSingle();

      return Number(data?.rental_expiry_duration ?? getDefaultRentalDurationHours("movie"));
    }

    if (contentType === "season") {
      const { data } = await supabase
        .from("seasons")
        .select("rental_expiry_duration")
        .eq("id", contentId)
        .maybeSingle();

      return Number(data?.rental_expiry_duration ?? getDefaultRentalDurationHours("season"));
    }

    const { data } = await supabase
      .from("episodes")
      .select("rental_expiry_duration")
      .eq("id", contentId)
      .maybeSingle();

    return Number(data?.rental_expiry_duration ?? getDefaultRentalDurationHours("episode"));
  } catch (error) {
    console.error("Failed to resolve rental expiry hours:", error);
    return getDefaultRentalDurationHours(contentType);
  }
}

async function validateReferralCode(
  supabase: ReturnType<typeof createClient>,
  code: string,
  userId: string,
  price: number,
): Promise<{ valid: boolean; error?: string; codeData?: ReferralCodeRow; discountAmount?: number }> {
  const { data, error } = await supabase
    .from("referral_codes")
    .select("id, code, discount_type, discount_value, valid_until, max_uses, times_used, min_purchase_amount, max_uses_per_user")
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return { valid: false, error: "Invalid referral code" };

  const codeData = data as ReferralCodeRow;

  if (codeData.valid_until && new Date(codeData.valid_until) < new Date()) {
    return { valid: false, error: "Code expired" };
  }

  if (codeData.max_uses && codeData.times_used >= codeData.max_uses) {
    return { valid: false, error: "Code fully redeemed" };
  }

  if (codeData.min_purchase_amount > 0 && price < codeData.min_purchase_amount) {
    return { valid: false, error: "Minimum purchase not met" };
  }

  const { count } = await supabase
    .from("referral_code_uses")
    .select("id", { count: "exact", head: true })
    .eq("code_id", codeData.id)
    .eq("user_id", userId);

  if (count !== null && count >= codeData.max_uses_per_user) {
    return { valid: false, error: "You have already used this code" };
  }

  const discountAmount = codeData.discount_type === "percentage"
    ? Math.floor((price * codeData.discount_value) / 100)
    : Math.min(codeData.discount_value, price);

  return { valid: true, codeData, discountAmount };
}

async function hasExistingRentalAccess(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  contentId: string,
  contentType: RentalContentType,
): Promise<boolean> {
  // Prefer the canonical RPC which understands episode->season delegation
  try {
    const { data, error } = await supabase.rpc("has_active_rental_access", {
      p_user_id: userId,
      p_content_id: contentId,
      p_content_type: contentType,
    });
    if (!error && data) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row && (row as Record<string, unknown>).has_access === true) return true;
    }
  } catch (rpcError) {
    console.warn("has_active_rental_access RPC failed, falling back to legacy lookup:", rpcError);
  }

  const now = new Date().toISOString();
  const rentalQuery = supabase
    .from("rentals")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["completed", "active"])
    .gte("expires_at", now)
    .order("expires_at", { ascending: false });

  if (contentType === "movie") {
    const { data, error } = await rentalQuery.eq("content_id", contentId).eq("content_type", "movie").maybeSingle();
    return !!data && !error;
  }

  if (contentType === "season") {
    const { data, error } = await rentalQuery.eq("content_id", contentId).eq("content_type", "season").maybeSingle();
    return !!data && !error;
  }

  const { data: episodeRental, error: episodeRentalError } = await rentalQuery
    .eq("content_id", contentId)
    .eq("content_type", "episode")
    .maybeSingle();

  if (episodeRental && !episodeRentalError) {
    return true;
  }

  const { data: episodeData, error: episodeError } = await supabase
    .from("episodes")
    .select("season_id")
    .eq("id", contentId)
    .maybeSingle();

  if (episodeError || !episodeData?.season_id) {
    return false;
  }

  const { data: seasonRental, error: seasonRentalError } = await rentalQuery
    .eq("content_id", episodeData.season_id)
    .eq("content_type", "season")
    .maybeSingle();

  return !!seasonRental && !seasonRentalError;
}

function buildContentFields(contentId: string, contentType: RentalContentType) {
  return {
    movie_id: contentType === "movie" ? contentId : null,
    season_id: contentType === "season" ? contentId : null,
    episode_id: contentType === "episode" ? contentId : null,
  };
}

async function createWalletRental(
  supabase: ReturnType<typeof createClient>,
  input: {
    userId: string;
    contentId: string;
    contentType: RentalContentType;
    price: number;
    finalPrice: number;
    expiresAt: string;
    referralCode?: string;
    discountApplied: number;
    metadata: Record<string, unknown>;
  },
) {
  // Atomic: lock wallet, deduct, insert rental_intent + rental_access in a single RPC.
  const { data: rpcData, error: rpcError } = await supabase.rpc("process_wallet_rental_payment", {
    p_user_id: input.userId,
    p_content_id: input.contentId,
    p_content_type: input.contentType,
    p_final_price: input.finalPrice,
    p_expires_at: input.expiresAt,
    p_metadata: input.metadata,
    p_referral_code: input.referralCode ?? null,
    p_discount_amount: input.discountApplied,
    p_provider_reference: null,
  });

  if (rpcError) throw rpcError;
  const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
    | { rental_intent_id: string; rental_access_id: string | null; wallet_balance: number }
    | null;
  if (!row?.rental_intent_id) throw new Error("Failed to process wallet rental");

  const updatedBalance = Number(row.wallet_balance ?? 0);

  // Mirror to legacy `payments` + `wallet_transactions` for the admin/finance views.
  const { data: wallet } = await supabase
    .from("wallets")
    .select("wallet_id, balance")
    .eq("user_id", input.userId)
    .maybeSingle();

  const walletRow = (wallet as WalletRow | null) ?? null;
  const balanceBefore = updatedBalance + input.finalPrice;

  const paymentMetadata = {
    ...input.metadata,
    payment_method: "wallet",
    payment_channel: "wallet",
    amount_paid: input.finalPrice,
    rental_intent_id: row.rental_intent_id,
    rental_access_id: row.rental_access_id,
  };

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      user_id: input.userId,
      amount: input.finalPrice,
      currency: "NGN",
      purpose: "rental",
      provider: "wallet",
      method: "wallet",
      enhanced_status: "completed",
      status: "completed",
      intent_id: row.rental_intent_id,
      transaction_type: "rental",
      transaction_date: new Date().toISOString(),
      metadata: paymentMetadata,
    })
    .select("id")
    .single();

  if (paymentError) throw paymentError;

  if (input.finalPrice > 0 && walletRow?.wallet_id) {
    const { error: walletTransactionError } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: walletRow.wallet_id,
        amount: input.finalPrice,
        balance_before: balanceBefore,
        balance_after: updatedBalance,
        transaction_type: "debit",
        description: `Rental: ${input.contentType}${input.referralCode ? ` (code: ${input.referralCode})` : ""}`,
        payment_id: payment.id,
        metadata: paymentMetadata,
      });
    if (walletTransactionError) console.warn("wallet_transactions insert failed:", walletTransactionError);
  }

  if (input.referralCode) {
    const { data: referralCodeData } = await supabase
      .from("referral_codes")
      .select("id, times_used")
      .eq("code", input.referralCode.toUpperCase())
      .maybeSingle();

    if (referralCodeData) {
      await supabase.from("referral_code_uses").insert({
        code_id: referralCodeData.id,
        user_id: input.userId,
        payment_id: payment.id,
        discount_applied: input.discountApplied,
      });
      await supabase
        .from("referral_codes")
        .update({ times_used: Number(referralCodeData.times_used ?? 0) + 1 })
        .eq("id", referralCodeData.id);
    }
  }

  // Mirror to legacy `rentals` for backward compatibility (best-effort).
  await supabase
    .from("rentals")
    .insert({
      user_id: input.userId,
      content_id: input.contentId,
      content_type: input.contentType,
      price: input.finalPrice,
      expires_at: input.expiresAt,
      status: "completed",
      payment_method: "wallet",
    });

  return {
    paymentId: payment.id,
    rentalId: row.rental_intent_id,
    walletBalance: updatedBalance,
  };
}

async function createPaystackRental(
  supabase: ReturnType<typeof createClient>,
  input: {
    userId: string;
    contentId: string;
    contentType: RentalContentType;
    price: number;
    finalPrice: number;
    expiresAt: string;
    referralCode?: string;
    discountApplied: number;
    metadata: Record<string, unknown>;
  },
  origin?: string,
) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email, name, first_name, last_name")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: "User profile not found", status: 404 };
  }

  // Create the rental_intent FIRST so the webhook can find it by reference.
  const fields = buildContentFields(input.contentId, input.contentType);
  const intentMetadata = {
    ...input.metadata,
    payment_method: "paystack",
    user_name: profile.name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Customer",
  };

  // The DB has a unique partial index on (user_id, content_id) WHERE status='pending'.
  // Mark any stale pending intents for the same user+content as failed before inserting.
  const stalePendingFilter: Record<string, unknown> = {
    user_id: input.userId,
    status: "pending",
  };
  if (fields.movie_id) stalePendingFilter.movie_id = fields.movie_id;
  if (fields.season_id) stalePendingFilter.season_id = fields.season_id;
  if (fields.episode_id) stalePendingFilter.episode_id = fields.episode_id;
  await supabase
    .from("rental_intents")
    .update({ status: "failed", failed_at: new Date().toISOString() })
    .match(stalePendingFilter);

  const { data: intent, error: intentError } = await supabase
    .from("rental_intents")
    .insert({
      user_id: input.userId,
      ...fields,
      rental_type: input.contentType,
      price: Math.round(input.finalPrice),
      currency: "NGN",
      payment_method: "paystack",
      status: "pending",
      referral_code: input.referralCode ?? null,
      discount_amount: Math.round(input.discountApplied),
      expires_at: input.expiresAt,
      metadata: intentMetadata,
    })
    .select("id")
    .single();

  if (intentError || !intent) {
    console.error("rental_intent insert failed:", intentError);
    return { error: "Failed to create rental intent", status: 500 };
  }

  const intentId = intent.id;
  const paymentMetadata = {
    ...input.metadata,
    payment_method: "paystack",
    rental_intent_id: intentId,
    user_name: profile.name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Customer",
  };

  const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
      user_id: input.userId,
      amount: Math.round(input.finalPrice),
      currency: "NGN",
      purpose: "rental",
      provider: "paystack",
      method: "paystack",
      enhanced_status: "initiated",
      status: "pending",
      intent_id: intentId,
      transaction_type: "rental",
      transaction_date: new Date().toISOString(),
      metadata: paymentMetadata,
    })
    .select("id")
    .single();

  if (paymentError) {
    await supabase.from("rental_intents").delete().eq("id", intentId);
    throw paymentError;
  }

  const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: profile.email,
      // Paystack expects kobo. Internal prices are already stored/passed in kobo.
      amount: Math.round(input.finalPrice),
      reference: intentId,
      metadata: {
        payment_id: payment.id,
        rental_intent_id: intentId,
        user_id: input.userId,
        content_id: input.contentId,
        content_type: input.contentType,
        purpose: "rental",
        referral_code: input.referralCode || null,
        discount_amount: input.discountApplied,
      },
    }),
  });

  if (!paystackResponse.ok) {
    const error = await paystackResponse.json().catch(() => ({}));
    console.error("Paystack error:", error);

    await supabase
      .from("payments")
      .update({
        enhanced_status: "failed",
        status: "failed",
        error_message: error?.message || "Failed to initialize payment",
      })
      .eq("id", payment.id);
    await supabase
      .from("rental_intents")
      .update({ status: "failed", failed_at: new Date().toISOString() })
      .eq("id", intentId);

    return { error: "Failed to initialize payment", status: 500 };
  }

  const paystackData = await paystackResponse.json();

  await supabase
    .from("payments")
    .update({
      provider_reference: paystackData.data.reference,
      enhanced_status: "pending",
    })
    .eq("id", payment.id);

  await supabase
    .from("rental_intents")
    .update({
      provider_reference: paystackData.data.reference,
      paystack_reference: paystackData.data.reference,
    })
    .eq("id", intentId);

  return {
    success: true,
    paymentMethod: "paystack" as const,
    rentalId: intentId,
    paymentId: payment.id,
    authorizationUrl: paystackData.data.authorization_url,
    paystackReference: paystackData.data.reference,
  };
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin") || undefined;

  if (req.method === "OPTIONS") {
    return new Response("OK", { status: 200, headers: getCorsHeaders(origin) });
  }

  try {
    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let body: ProcessRentalRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return createResponse({ error: "Invalid request body" }, 400, origin);
    }

    const { userId, contentId, contentType, price, paymentMethod, referralCode } = body;
    const normalizedType = normalizeContentType(contentType);

    if (!userId || !contentId || !normalizedType || typeof price !== "number" || !paymentMethod) {
      return createResponse({ error: "Missing required fields" }, 400, origin);
    }

    const accessExists = await hasExistingRentalAccess(supabase, userId, contentId, normalizedType);
    if (accessExists) {
      return createResponse({ error: "User already has active rental for this content" }, 409, origin);
    }

    let finalPrice = price;
    let discountApplied = 0;

    if (referralCode) {
      const referralResult = await validateReferralCode(supabase, referralCode, userId, price);

      if (!referralResult.valid) {
        return createResponse({ error: referralResult.error || "Invalid referral code" }, 400, origin);
      }

      discountApplied = referralResult.discountAmount || 0;
      finalPrice = Math.max(0, price - discountApplied);
    }

    const expiresAt = buildExpiryAt(normalizedType, await getRentalExpiryHours(supabase, contentId, normalizedType));
    const paymentMetadata = {
      content_id: contentId,
      content_type: normalizedType,
      original_price: price,
      payment_method: paymentMethod,
      ...(referralCode
        ? {
            referral_code: referralCode.toUpperCase(),
            discount_amount: discountApplied,
          }
        : {}),
    };

    if (paymentMethod === "wallet") {
      try {
        const walletResult = await createWalletRental(supabase, {
          userId,
          contentId,
          contentType: normalizedType,
          price,
          finalPrice,
          expiresAt,
          referralCode: referralCode || undefined,
          discountApplied,
          metadata: paymentMetadata,
        });

        return createResponse({
          success: true,
          paymentMethod: "wallet",
          rentalId: walletResult.rentalId,
          paymentId: walletResult.paymentId,
          rentalExpiresAt: expiresAt,
          walletBalance: walletResult.walletBalance,
          discountApplied,
        }, 200, origin);
      } catch (walletError) {
        const errorMessage = walletError instanceof Error ? walletError.message : String(walletError);
        console.error("Wallet rental processing failed:", walletError);
        return createResponse({ error: errorMessage || "Failed to process wallet rental" }, 500, origin);
      }
    }

    try {
      const paystackResult = await createPaystackRental(
        supabase,
        {
          userId,
          contentId,
          contentType: normalizedType,
          price,
          finalPrice,
          expiresAt,
          referralCode: referralCode || undefined,
          discountApplied,
          metadata: paymentMetadata,
        },
        origin,
      );

      if ("error" in paystackResult) {
        return createResponse({ error: paystackResult.error }, paystackResult.status, origin);
      }

      return createResponse({
        success: true,
        paymentMethod: "paystack",
        rentalId: paystackResult.rentalId,
        paymentId: paystackResult.paymentId,
        authorizationUrl: paystackResult.authorizationUrl,
        paystackReference: paystackResult.paystackReference,
        discountApplied,
      }, 200, origin);
    } catch (paystackError) {
      const errorMessage = paystackError instanceof Error ? paystackError.message : String(paystackError);
      console.error("Paystack rental processing failed:", paystackError);
      return createResponse({ error: errorMessage || "Failed to initialize paystack payment" }, 500, origin);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in process-rental:", errorMessage);
    return createResponse({
      error: "Internal server error",
      details: errorMessage,
    }, 500, origin);
  }
});

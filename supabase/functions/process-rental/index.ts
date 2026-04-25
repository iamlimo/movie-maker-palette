import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { normalizeContentType, getDefaultRentalDurationHours, hasActiveRentalAccess, buildRentalIntentPayload } from "../_shared/rental.ts";

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

function buildExpiryAt(contentType: "movie" | "episode" | "season") {
  const expiryHours = getDefaultRentalDurationHours(contentType);
  return new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin") || undefined;

  if (req.method === "OPTIONS") {
    return new Response("OK", { status: 200, headers: getCorsHeaders(origin) });
  }

  try {
    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
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

    const accessResult = await hasActiveRentalAccess(supabase, userId, contentId, normalizedType);
    if (accessResult.has_access) {
      return createResponse({ error: "User already has active rental for this content" }, 409, origin);
    }

    let finalPrice = price;
    let discountApplied = 0;

    if (referralCode) {
      const { data: codeData } = await supabase
        .from("referral_codes")
        .select("id, discount_type, discount_value")
        .eq("code", referralCode.toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (codeData) {
        if (codeData.discount_type === "percentage") {
          discountApplied = Math.floor((price * codeData.discount_value) / 100);
        } else {
          discountApplied = Math.min(codeData.discount_value, price);
        }
        finalPrice = Math.max(0, price - discountApplied);
      }
    }

    const expiresAt = buildExpiryAt(normalizedType);

    if (paymentMethod === "wallet") {
      const { data, error } = await supabase.rpc("process_wallet_rental_payment", {
        p_user_id: userId,
        p_content_id: contentId,
        p_content_type: normalizedType,
        p_final_price: finalPrice,
        p_expires_at: expiresAt,
        p_metadata: {
          content_id: contentId,
          content_type: normalizedType,
          original_price: price,
          payment_method: "wallet",
        },
        p_referral_code: referralCode || null,
        p_discount_amount: discountApplied,
        p_provider_reference: null,
      });

      if (error) {
        console.error("Wallet rental RPC error:", error);
        return createResponse({ error: error.message || "Failed to process wallet rental" }, 500, origin);
      }

      const rows = Array.isArray(data) ? data : [];
      const row = rows[0] as { rental_intent_id?: string; rental_access_id?: string; wallet_balance?: number; expires_at?: string } | undefined;

      return createResponse({
        success: true,
        rentalIntentId: row?.rental_intent_id ?? null,
        rentalAccessId: row?.rental_access_id ?? null,
        paymentMethod: "wallet",
        walletBalance: row?.wallet_balance ?? null,
        expiresAt: row?.expires_at ?? expiresAt,
        discountApplied,
      }, 200, origin);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, raw_user_meta_data")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return createResponse({ error: "User profile not found" }, 404, origin);
    }

    const userMeta = profile.raw_user_meta_data as { full_name?: string } | null;
    const fullName = userMeta?.full_name || profile.email?.split("@")[0] || "Customer";
    const intentId = crypto.randomUUID();

    const rentalIntentPayload = buildRentalIntentPayload({
      userId,
      contentId,
      contentType: normalizedType,
      price: finalPrice,
      paymentMethod: "paystack",
      status: "pending",
      providerReference: intentId,
      paystackReference: null,
      referralCode: referralCode || null,
      discountAmount: discountApplied,
      expiresAt,
      metadata: {
        content_id: contentId,
        content_type: normalizedType,
        original_price: price,
        payment_method: "paystack",
        user_name: fullName,
      },
    });

    const { data: rentalIntent, error: rentalIntentError } = await supabase
      .from("rental_intents")
      .insert(rentalIntentPayload)
      .select("id")
      .single();

    if (rentalIntentError) {
      console.error("Rental intent creation error:", rentalIntentError);
      return createResponse({ error: "Failed to create rental intent" }, 500, origin);
    }

    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: profile.email,
        amount: Math.round(finalPrice * 100),
        reference: intentId,
        callback_url: `${SUPABASE_URL}/functions/v1/verify-payment`,
        metadata: {
          rental_intent_id: rentalIntent.id,
          user_id: userId,
          content_id: contentId,
          content_type: normalizedType,
          purpose: "rental",
          referral_code: referralCode || null,
          discount_amount: discountApplied,
        },
      }),
    });

    if (!paystackResponse.ok) {
      const error = await paystackResponse.json().catch(() => ({}));
      console.error("Paystack error:", error);
      await supabase.from("rental_intents").update({ status: "failed", failed_at: new Date().toISOString() }).eq("id", rentalIntent.id);
      return createResponse({ error: "Failed to initialize payment" }, 500, origin);
    }

    const paystackData = await paystackResponse.json();

    await supabase
      .from("rental_intents")
      .update({
        paystack_reference: paystackData.data.reference,
        provider_reference: paystackData.data.reference,
        metadata: {
          content_id: contentId,
          content_type: normalizedType,
          original_price: price,
          payment_method: "paystack",
          user_name: fullName,
          paystack_access_code: paystackData.data.access_code,
        },
      })
      .eq("id", rentalIntent.id);

    return createResponse({
      success: true,
      paymentMethod: "paystack",
      rentalIntentId: rentalIntent.id,
      authorizationUrl: paystackData.data.authorization_url,
      paystackReference: paystackData.data.reference,
      discountApplied,
    }, 200, origin);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in process-rental:", errorMessage);
    return createResponse({
      error: "Internal server error",
      details: errorMessage,
    }, 500, origin);
  }
});

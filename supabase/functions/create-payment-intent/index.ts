import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

// --- Shared Utilities ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUser(req: Request, supabaseClient: any) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) throw new Error("No authorization header");
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

function handleOptions(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

// --- Main Function ---
interface PaymentIntentRequest {
  amount: number;
  currency?: string;
  purpose: "wallet_topup" | "rental" | "purchase" | "subscription";
  metadata?: any;
  email: string;
}

serve(async (req) => {
  // Always handle OPTIONS before parsing the body!
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const user = await getUser(req, supabaseClient);

    const idempotencyKey = req.headers.get("idempotency-key");
    if (!idempotencyKey) throw new Error("Idempotency-Key header is required");

    // Only parse JSON for non-OPTIONS requests
    const body: PaymentIntentRequest = await req.json();
    const { amount, currency = "NGN", purpose, metadata = {}, email } = body;

    if (!amount || amount < 100)
      throw new Error("Amount must be at least 100 kobo (1 NGN)");

    // Check for existing payment intent
    const { data: existingPayment } = await supabaseClient
      .from("payments")
      .select("*")
      .eq("intent_id", idempotencyKey)
      .single();

    if (existingPayment) {
      const paystackResponse = {
        authorization_url: `https://checkout.paystack.com/v1/transaction/${existingPayment.provider_reference}`,
        access_code: existingPayment.provider_reference,
        reference: existingPayment.provider_reference,
      };
      return jsonResponse({
        success: true,
        payment_id: existingPayment.id,
        paystack: paystackResponse,
      });
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabaseClient
      .from("payments")
      .insert({
        user_id: user.id,
        amount: amount / 100,
        currency,
        purpose,
        metadata,
        provider: "paystack",
        intent_id: idempotencyKey,
        enhanced_status: "initiated",
        transaction_type: purpose === "wallet_topup" ? "credit" : "debit",
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Payment creation error:", paymentError);
      throw new Error("Failed to create payment record");
    }

    // Initialize Paystack transaction
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey)
      throw new Error("Paystack secret key not configured");

    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount,
          currency,
          reference: payment.id,
          callback_url: `${Deno.env.get(
            "SUPABASE_URL"
          )}/functions/v1/paystack-webhook`,
          metadata: {
            ...metadata,
            payment_id: payment.id,
            user_id: user.id,
            purpose,
          },
        }),
      }
    );

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      console.error("Paystack initialization error:", paystackData);
      await supabaseClient
        .from("payments")
        .update({
          enhanced_status: "failed",
          error_message:
            paystackData.message || "Paystack initialization failed",
        })
        .eq("id", payment.id);
      throw new Error(
        paystackData.message || "Failed to initialize Paystack transaction"
      );
    }

    await supabaseClient
      .from("payments")
      .update({
        provider_reference: paystackData.data.reference,
        enhanced_status: "pending",
      })
      .eq("id", payment.id);

    await supabaseClient.rpc("log_finance_action", {
      p_action: "payment_intent_created",
      p_details: {
        payment_id: payment.id,
        amount: amount,
        currency,
        purpose,
        paystack_reference: paystackData.data.reference,
      },
    });

    return jsonResponse({
      success: true,
      payment_id: payment.id,
      paystack: paystackData.data,
    });
  } catch (error: any) {
    console.error("Error in create-payment-intent:", error);
    return jsonResponse(
      {
        success: false,
        error: error.message,
        stack: error.stack, // Add this line for debugging
      },
      500
    );
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, jsonResponse, handleOptions, errorResponse } from "../_shared/cors.ts";
import { authenticateUser, checkRateLimit } from "../_shared/auth.ts";
import { PaymentProcessor } from "../_shared/payment-processor.ts";
import { validateIdempotencyKey } from "../_shared/validation.ts";

serve(async (req) => {
  // Handle CORS preflight
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    // Authenticate user
    const { user, supabase } = await authenticateUser(req);
    
    // Rate limiting
    if (!checkRateLimit(`payment_${user.id}`, 10, 60000)) {
      return errorResponse("Rate limit exceeded. Please try again later.", 429);
    }

    // Validate idempotency key
    const idempotencyKey = req.headers.get("idempotency-key");
    if (idempotencyKey) {
      const keyValidation = validateIdempotencyKey(idempotencyKey);
      if (!keyValidation.isValid) {
        return errorResponse(keyValidation.errors.join(', '));
      }

      // Check for existing payment
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("*")
        .eq("intent_id", idempotencyKey)
        .single();

      if (existingPayment) {
        // Return existing payment
        let checkout_url = null;
        if (existingPayment.provider === 'paystack' && existingPayment.provider_reference) {
          checkout_url = `https://checkout.paystack.com/v1/transaction/${existingPayment.provider_reference}`;
        }

        return jsonResponse({
          success: true,
          payment_id: existingPayment.id,
          checkout_url,
          status: existingPayment.enhanced_status
        });
      }
    }

    // Parse request body
    const body = await req.json();
    
    // Process payment
    const processor = new PaymentProcessor(supabase, user);
    const result = await processor.processPayment(body);

    // Log payment attempt
    await supabase.rpc("log_finance_action", {
      p_action: "payment_processed",
      p_details: {
        payment_id: result.payment_id,
        purpose: body.purpose,
        amount: body.amount,
        method: body.paymentMethod || 'card',
        success: result.success
      },
    });

    if (result.success) {
      return jsonResponse(result);
    } else {
      return errorResponse(result.error || 'Payment processing failed', 500);
    }

  } catch (error: any) {
    console.error("Error in unified-payment:", error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
});
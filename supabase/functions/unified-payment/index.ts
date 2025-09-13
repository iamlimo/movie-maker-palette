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

    // Parse request body with validation
    let body;
    try {
      const contentType = req.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return errorResponse("Content-Type must be application/json", 400);
      }
      
      const bodyText = await req.text();
      if (!bodyText.trim()) {
        return errorResponse("Request body cannot be empty", 400);
      }
      
      body = JSON.parse(bodyText);
    } catch (error: any) {
      console.error("JSON parsing error:", error);
      return errorResponse("Invalid JSON in request body", 400);
    }

    // Validate required fields
    if (!body.amount || typeof body.amount !== 'number' || body.amount <= 0) {
      return errorResponse("Valid amount is required", 400);
    }
    
    if (!body.purpose || typeof body.purpose !== 'string') {
      return errorResponse("Valid purpose is required", 400);
    }
    
    // Process payment with enhanced rental validation
    const processor = new PaymentProcessor(supabase, user);
    
    // For rentals, check if user already has access
    if (body.purpose === 'rental' && body.metadata?.content_id) {
      const { data: existingRental } = await supabase
        .from("rentals")
        .select("*")
        .eq("user_id", user.id)
        .eq("content_id", body.metadata.content_id)
        .eq("content_type", body.metadata.content_type)
        .eq("status", "active")
        .gte("expiration_date", new Date().toISOString())
        .maybeSingle();

      if (existingRental) {
        return errorResponse("You already have an active rental for this content", 409);
      }
    }
    
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
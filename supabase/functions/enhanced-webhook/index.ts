// Phase 3: Enhanced Webhook Security & Processing
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { corsHeaders, jsonResponse, handleOptions } from "../_shared/cors.ts";

// Rate limiting for webhook events
const webhookRateLimit = new Map<string, { count: number; resetTime: number }>();

function checkWebhookRateLimit(identifier: string, maxRequests = 100, windowMs = 60000): boolean {
  const now = Date.now();
  const key = identifier;
  const entry = webhookRateLimit.get(key);

  if (!entry || now > entry.resetTime) {
    webhookRateLimit.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

// Webhook signature verification with proper HMAC-SHA512
async function verifyPaystackSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    // Remove '0x' prefix if present and convert hex to bytes
    const hexSignature = signature.startsWith('0x') ? signature.slice(2) : signature;
    
    // Convert hex string to Uint8Array
    const signatureBytes = new Uint8Array(
      hexSignature.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
    
    // Import the secret key for HMAC
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['verify']
    );
    
    // Verify the signature
    const dataBytes = encoder.encode(body);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      dataBytes
    );
    
    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Webhook event deduplication
const processedEvents = new Set<string>();

function isEventProcessed(eventId: string): boolean {
  return processedEvents.has(eventId);
}

function markEventProcessed(eventId: string): void {
  processedEvents.add(eventId);
  
  // Clean up old events (keep last 1000)
  if (processedEvents.size > 1000) {
    const iterator = processedEvents.values();
    for (let i = 0; i < 100; i++) {
      const value = iterator.next().value;
      if (value) processedEvents.delete(value);
    }
  }
}

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Get request details
    const clientIP = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";
    const signature = req.headers.get("x-paystack-signature") || "";
    
    // Rate limiting
    if (!checkWebhookRateLimit(clientIP)) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return jsonResponse({ error: "Rate limit exceeded" }, 429);
    }

    // Get raw body for signature verification
    const body = await req.text();
    
    // Verify webhook signature
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      throw new Error("Paystack secret key not configured");
    }

    const isValidSignature = await verifyPaystackSignature(body, signature, paystackSecret);
    if (!isValidSignature) {
      console.warn(`Invalid webhook signature from IP: ${clientIP}`);
      return jsonResponse({ error: "Invalid signature" }, 401);
    }

    // Parse webhook data
    const webhookData = JSON.parse(body);
    const { event, data: eventData } = webhookData;

    console.log(`Processing webhook event: ${event} from IP: ${clientIP}`);

    // Check for event duplication
    const eventId = `${event}_${eventData.reference}_${eventData.id}`;
    if (isEventProcessed(eventId)) {
      console.log(`Duplicate event detected: ${eventId}`);
      return jsonResponse({ status: "duplicate_event" });
    }

    // Log webhook event
    const { data: webhookLog, error: logError } = await supabase
      .from("webhook_events")
      .insert({
        provider: "paystack",
        event_type: event,
        provider_event_id: eventData.id,
        payload: webhookData
      })
      .select()
      .single();

    if (logError) {
      console.error("Error logging webhook event:", logError);
    }

    // Process based on event type
    let processingResult = { success: false, message: "Unhandled event type" };

    switch (event) {
      case "charge.success":
        processingResult = await processSuccessfulCharge(supabase, eventData);
        break;
      case "charge.failed":
        processingResult = await processFailedCharge(supabase, eventData);
        break;
      case "transfer.success":
        processingResult = await processSuccessfulTransfer(supabase, eventData);
        break;
      case "transfer.failed":
        processingResult = await processFailedTransfer(supabase, eventData);
        break;
      default:
        console.log(`Unhandled webhook event: ${event}`);
        processingResult = { success: true, message: "Event acknowledged but not processed" };
    }

    // Update webhook log with processing result
    if (webhookLog) {
      await supabase
        .from("webhook_events")
        .update({
          processed_at: new Date().toISOString()
        })
        .eq("event_id", webhookLog.event_id);
    }

    // Mark event as processed
    markEventProcessed(eventId);

    // Log finance action
    await supabase.rpc("log_finance_action", {
      p_action: "webhook_processed",
      p_details: {
        event_type: event,
        event_id: eventId,
        success: processingResult.success,
        message: processingResult.message
      }
    });

    return jsonResponse({
      status: "success",
      message: processingResult.message
    });

  } catch (error: any) {
    console.error("Webhook processing error:", error);
    
    // Log error
    await supabase.rpc("log_finance_action", {
      p_action: "webhook_error",
      p_details: {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });

    return jsonResponse({
      status: "error",
      message: error.message
    }, 500);
  }
});

async function processSuccessfulCharge(supabase: any, eventData: any) {
  try {
    const { reference, amount, metadata } = eventData;

    // Find the payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", reference)
      .single();

    if (paymentError || !payment) {
      throw new Error(`Payment not found for reference: ${reference}`);
    }

    // Update payment status
    await supabase
      .from("payments")
      .update({
        enhanced_status: "completed",
        status: "success",
        provider_reference: eventData.reference,
        updated_at: new Date().toISOString()
      })
      .eq("id", payment.id);

    // Process payment fulfillment based on purpose
    switch (payment.purpose) {
      case "wallet_topup":
        await fulfillWalletTopup(supabase, payment, amount / 100);
        break;
      case "rental":
        await fulfillRental(supabase, payment);
        break;
      case "purchase":
        await fulfillPurchase(supabase, payment);
        break;
    }

    return { success: true, message: "Charge processed successfully" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

async function processFailedCharge(supabase: any, eventData: any) {
  try {
    const { reference } = eventData;

    await supabase
      .from("payments")
      .update({
        enhanced_status: "failed",
        status: "failed",
        error_message: eventData.gateway_response || "Payment failed",
        updated_at: new Date().toISOString()
      })
      .eq("id", reference);

    return { success: true, message: "Failed charge processed" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

async function processSuccessfulTransfer(supabase: any, eventData: any) {
  // Handle successful transfer events (for payouts)
  return { success: true, message: "Transfer processed successfully" };
}

async function processFailedTransfer(supabase: any, eventData: any) {
  // Handle failed transfer events (for payouts)
  return { success: true, message: "Failed transfer processed" };
}

async function fulfillWalletTopup(supabase: any, payment: any, amount: number) {
  // Get user's wallet
  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", payment.user_id)
    .single();

  if (!wallet) {
    throw new Error("User wallet not found");
  }

  // Process wallet transaction
  await supabase.rpc("process_wallet_transaction", {
    p_wallet_id: wallet.wallet_id,
    p_amount: amount,
    p_type: "credit",
    p_description: "Wallet top-up via Paystack",
    p_payment_id: payment.id,
    p_metadata: { source: "paystack_webhook" }
  });
}

async function fulfillRental(supabase: any, payment: any) {
  const metadata = payment.metadata;
  
  if (!metadata.content_id || !metadata.content_type) {
    throw new Error("Missing rental metadata");
  }

  const expirationDate = new Date();
  expirationDate.setHours(expirationDate.getHours() + (metadata.rental_duration || 48));

  await supabase
    .from("rentals")
    .insert({
      user_id: payment.user_id,
      content_id: metadata.content_id,
      content_type: metadata.content_type,
      price_paid: payment.amount,
      expiration_date: expirationDate.toISOString(),
      status: "active"
    });
}

async function fulfillPurchase(supabase: any, payment: any) {
  const metadata = payment.metadata;
  
  if (!metadata.content_id || !metadata.content_type) {
    throw new Error("Missing purchase metadata");
  }

  await supabase
    .from("purchases")
    .insert({
      user_id: payment.user_id,
      content_id: metadata.content_id,
      content_type: metadata.content_type,
      price_paid: payment.amount
    });
}

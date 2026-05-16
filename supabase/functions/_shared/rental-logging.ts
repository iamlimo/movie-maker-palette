// PHASE 8: Unified Logging Utility for Rental System
// 
// This module provides a simple interface for logging rental steps.
// All rental events are logged to the rental_audit_log table for debugging.

export interface RentalLogEntry {
  step: 'access_check' | 'validation' | 'intent_created' | 'payment_started' | 'payment_confirmed' | 'webhook_received' | 'access_granted' | 'error';
  status: 'pending' | 'success' | 'error';
  message?: string;
  metadata?: Record<string, unknown>;
  rentalIntentId?: string;
  rentalAccessId?: string;
  paymentMethod?: string;
  amountKobo?: number;
}

/**
 * Log a step in the rental process
 */
export async function logRentalStep(
  supabase: any,
  userId: string,
  contentId: string,
  contentType: string,
  entry: RentalLogEntry,
): Promise<void> {
  try {
    const { error } = await supabase.rpc('log_rental_step', {
      p_user_id: userId,
      p_content_id: contentId,
      p_content_type: contentType,
      p_step: entry.step,
      p_status: entry.status,
      p_message: entry.message || null,
      p_metadata: entry.metadata || {},
      p_rental_intent_id: entry.rentalIntentId || null,
      p_rental_access_id: entry.rentalAccessId || null,
      p_payment_method: entry.paymentMethod || null,
      p_amount_kobo: entry.amountKobo || null,
    });

    if (error) {
      console.warn('[logRentalStep] Failed to log rental step:', error);
      // Don't throw - logging should never fail the main flow
    }
  } catch (err) {
    console.error('[logRentalStep] Unexpected error:', err);
    // Silently fail - logging is best-effort
  }
}

/**
 * Format a log entry with standardized prefix
 */
export function formatLog(functionName: string, context: string, message: string): string {
  return `[${functionName}] ${context} ${message}`;
}

/**
 * Structured logging for rental operations
 */
export const RentalLogger = {
  accessCheck: (contentId: string, contentType: string, hasAccess: boolean) => ({
    step: 'access_check' as const,
    status: 'success' as const,
    message: `Access check: ${contentType}/${contentId} - ${hasAccess ? 'GRANTED' : 'DENIED'}`,
    metadata: { content_id: contentId, content_type: contentType, has_access: hasAccess },
  }),

  intentCreated: (intentId: string, amountKobo: number, paymentMethod: string) => ({
    step: 'intent_created' as const,
    status: 'success' as const,
    message: `Rental intent created: ${intentId}`,
    metadata: { intent_id: intentId, amount_kobo: amountKobo, payment_method: paymentMethod },
    rentalIntentId: intentId,
    paymentMethod,
    amountKobo,
  }),

  paymentStarted: (intentId: string, paymentMethod: string) => ({
    step: 'payment_started' as const,
    status: 'pending' as const,
    message: `Payment initiated via ${paymentMethod}`,
    metadata: { payment_method: paymentMethod },
    rentalIntentId: intentId,
    paymentMethod,
  }),

  paymentConfirmed: (intentId: string, reference: string, amountKobo: number) => ({
    step: 'payment_confirmed' as const,
    status: 'success' as const,
    message: `Payment confirmed: ${reference}`,
    metadata: { reference, amount_kobo: amountKobo },
    rentalIntentId: intentId,
    amountKobo,
  }),

  accessGranted: (intentId: string, accessId: string, expiresAt: string) => ({
    step: 'access_granted' as const,
    status: 'success' as const,
    message: `Access granted: ${accessId} expires at ${expiresAt}`,
    metadata: { access_id: accessId, expires_at: expiresAt },
    rentalIntentId: intentId,
    rentalAccessId: accessId,
  }),

  error: (step: string, message: string, errorData?: any) => ({
    step: 'error' as const,
    status: 'error' as const,
    message: `${step} failed: ${message}`,
    metadata: errorData || { error_message: message },
  }),
};

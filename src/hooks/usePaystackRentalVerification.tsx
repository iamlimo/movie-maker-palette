import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentStatus {
  success: boolean;
  status: 'completed' | 'pending' | 'failed' | 'cancelled' | 'unknown';
  payment?: {
    channel?: string;
    status?: string;
    message?: string;
  };
  rental?: {
    id: string;
    status: string;
    expiresAt: string;
  };
  message?: string;
  error?: string;
}

interface VerificationPaymentPayload {
  channel?: string;
  status?: string;
  message?: string;
  enhanced_status?: string;
  provider_reference?: string;
}

interface VerificationResponse {
  success?: boolean;
  payment?: VerificationPaymentPayload;
  paystack_status?: VerificationPaymentPayload & {
    reference?: string;
  };
  rental?: {
    id: string;
    status?: string;
    expiresAt?: string;
    expires_at?: string;
  };
  related_records?: {
    rental_access?: Array<{
      id?: string;
      status?: string;
      expires_at?: string;
    }>;
  };
  message?: string;
  error?: string;
}

const SUCCESS_STATUSES = new Set(['completed', 'success', 'successful', 'paid']);
const PENDING_STATUSES = new Set(['pending', 'processing', 'initiated', 'abandoned']);
const FAILED_STATUSES = new Set(['failed', 'cancelled', 'canceled', 'rejected']);

function normalizeVerificationResponse(raw: VerificationResponse): PaymentStatus {
  const paymentRecord = raw.payment ?? raw.paystack_status;
  const statusSource =
    paymentRecord?.status ??
    paymentRecord?.enhanced_status ??
    raw.rental?.status ??
    raw.message ??
    '';

  const normalizedStatus = statusSource.toLowerCase().trim();

  const rentalAccess = raw.related_records?.rental_access?.[0];
  const rental = raw.rental
    ? {
        id: raw.rental.id,
        status: raw.rental.status ?? 'unknown',
        expiresAt: raw.rental.expiresAt ?? raw.rental.expires_at ?? '',
      }
    : rentalAccess?.id
      ? {
          id: rentalAccess.id,
          status: rentalAccess.status ?? 'unknown',
          expiresAt: rentalAccess.expires_at ?? '',
        }
      : undefined;

  const payment = paymentRecord
    ? {
        channel: paymentRecord.channel,
        status: paymentRecord.status ?? paymentRecord.enhanced_status,
        message: paymentRecord.message,
      }
    : undefined;

  if (SUCCESS_STATUSES.has(normalizedStatus)) {
    return {
      success: true,
      status: 'completed',
      payment,
      rental,
      message: raw.message || paymentRecord?.message || 'Payment completed successfully',
    };
  }

  if (FAILED_STATUSES.has(normalizedStatus)) {
    return {
      success: false,
      status: normalizedStatus === 'cancelled' || normalizedStatus === 'canceled' ? 'cancelled' : 'failed',
      payment,
      rental,
      message: raw.message || paymentRecord?.message || 'Payment failed or was cancelled',
    };
  }

  if (PENDING_STATUSES.has(normalizedStatus)) {
    return {
      success: false,
      status: 'pending',
      payment,
      rental,
      message: raw.message || paymentRecord?.message || 'Payment is still being processed',
    };
  }

  return {
    success: false,
    status: 'unknown',
    payment,
    rental,
    message: raw.message || paymentRecord?.message || 'Unable to determine payment status',
    error: raw.error,
  };
}

/**
 * @deprecated Rental/payment polling verification is legacy.
 * Canonical flow uses backend entitlements (`rental-access` + `v_user_entitlements`)
 * and realtime updates; no client polling of `verify-payment`.
 */
export const usePaystackRentalVerification = () => {
  const [verifying, setVerifying] = useState(false);

  const verifyPayment = useCallback(async (rentalId: string, reference?: string): Promise<PaymentStatus> => {
    setVerifying(true);

    try {
      const verificationReference = reference || rentalId;

      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: {
          rentalId,
          rental_intent_id: rentalId,
          reference: verificationReference,
          payment_id: verificationReference,
        },
      });

      if (error) {
        return {
          success: false,
          status: 'unknown',
          error: error.message || 'Verification failed',
        };
      }

      return normalizeVerificationResponse((data ?? {}) as VerificationResponse);
    } catch (error) {
      console.error('Payment verification error:', error);
      return {
        success: false,
        status: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      setVerifying(false);
    }
  }, []);

  return {
    verifyPayment,
    verifying,
  };
};

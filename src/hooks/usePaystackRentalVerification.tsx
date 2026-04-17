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

export const usePaystackRentalVerification = () => {
  const [verifying, setVerifying] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const maxPolls = 60; // Maximum 60 polls (5 minutes with 5-second interval)
  const pollInterval = 5000; // 5 seconds

  const verifyPayment = useCallback(async (rentalId: string, reference?: string): Promise<PaymentStatus> => {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-rental-payment', {
        body: {
          rentalId,
          reference,
        },
      });

      if (error) {
        return {
          success: false,
          status: 'unknown',
          error: error.message || 'Verification failed',
        };
      }

      return data as PaymentStatus;
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

  const pollPaymentStatus = useCallback(
    async (rentalId: string, reference?: string, onUpdate?: (status: PaymentStatus) => void): Promise<PaymentStatus> => {
      let status: PaymentStatus = {
        success: false,
        status: 'pending',
        message: 'Checking payment status...',
      };

      let currentPoll = 0;

      while (currentPoll < maxPolls) {
        status = await verifyPayment(rentalId, reference);
        onUpdate?.(status);
        setPollCount(currentPoll);

        if (status.success || status.status === 'failed' || status.status === 'cancelled') {
          // Payment completed or failed, stop polling
          break;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        currentPoll++;
      }

      if (currentPoll >= maxPolls && !status.success) {
        status = {
          success: false,
          status: 'pending',
          message: 'Payment verification timeout. Please check your payment status in your bank app.',
        };
      }

      return status;
    },
    [verifyPayment]
  );

  return {
    verifyPayment,
    pollPaymentStatus,
    verifying,
    pollCount,
    maxPolls,
  };
};

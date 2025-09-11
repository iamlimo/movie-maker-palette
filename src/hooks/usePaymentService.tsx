// Modern Payment Hook using the Payment Service
import { useState, useEffect, useCallback } from 'react';
import { PaymentService, PaymentState, PaymentRequest, PaymentResult } from '@/services/PaymentService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const usePaymentService = () => {
  const [state, setState] = useState<PaymentState>(PaymentService.getInstance().getState());
  const { user } = useAuth();

  useEffect(() => {
    const unsubscribe = PaymentService.getInstance().subscribe(setState);
    return unsubscribe;
  }, []);

  const processPayment = useCallback(async (request: PaymentRequest): Promise<PaymentResult> => {
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const result = await PaymentService.getInstance().processPayment(request);
    
    if (!result.success) {
      toast({
        title: "Payment Failed",
        description: result.error || "An error occurred during payment processing",
        variant: "destructive",
      });
    }

    return result;
  }, [user]);

  const walletTopup = useCallback(async (amount: number): Promise<PaymentResult> => {
    const result = await PaymentService.getInstance().walletTopup(amount);
    
    if (result.success && result.checkout_url) {
      PaymentService.getInstance().openCheckout(result.checkout_url);
      toast({
        title: "Redirecting to Payment",
        description: "Complete your payment to top up your wallet.",
      });
    }

    return result;
  }, []);

  const walletPayment = useCallback(async (amount: number, purpose: 'rental' | 'purchase', metadata?: any): Promise<PaymentResult> => {
    const result = await PaymentService.getInstance().walletPayment(amount, purpose, metadata);
    
    if (result.success) {
      toast({
        title: "Payment Successful",
        description: `Payment completed using wallet balance.`,
      });
    }

    return result;
  }, []);

  const rentContent = useCallback(async (
    contentId: string, 
    contentType: 'movie' | 'episode', 
    amount: number, 
    rentalDuration = 48,
    paymentMethod: 'card' | 'wallet' = 'card'
  ): Promise<PaymentResult> => {
    const request: PaymentRequest = {
      amount: amount * 100,
      purpose: 'rental',
      metadata: {
        content_id: contentId,
        content_type: contentType,
        rental_duration: rentalDuration
      },
      paymentMethod
    };

    const result = await processPayment(request);
    
    if (result.success) {
      if (paymentMethod === 'wallet') {
        toast({
          title: "Rental Successful",
          description: `Content rented successfully for ${rentalDuration} hours.`,
        });
      } else if (result.checkout_url) {
        PaymentService.getInstance().openCheckout(result.checkout_url);
        toast({
          title: "Redirecting to Payment",
          description: "Complete your payment to rent this content.",
        });
      }
    }

    return result;
  }, [processPayment]);

  const purchaseContent = useCallback(async (
    contentId: string, 
    contentType: 'movie' | 'episode', 
    amount: number,
    paymentMethod: 'card' | 'wallet' = 'card'
  ): Promise<PaymentResult> => {
    const request: PaymentRequest = {
      amount: amount * 100,
      purpose: 'purchase',
      metadata: {
        content_id: contentId,
        content_type: contentType
      },
      paymentMethod
    };

    const result = await processPayment(request);
    
    if (result.success) {
      if (paymentMethod === 'wallet') {
        toast({
          title: "Purchase Successful",
          description: "Content purchased successfully. You now own this content forever.",
        });
      } else if (result.checkout_url) {
        PaymentService.getInstance().openCheckout(result.checkout_url);
        toast({
          title: "Redirecting to Payment",
          description: "Complete your payment to purchase this content.",
        });
      }
    }

    return result;
  }, [processPayment]);

  const getPaymentHistory = useCallback(async (limit = 10) => {
    return PaymentService.getInstance().getPaymentHistory(limit);
  }, []);

  const verifyPayment = useCallback(async (paymentId: string) => {
    return PaymentService.getInstance().verifyPayment(paymentId);
  }, []);

  const retryPayment = useCallback(async (paymentId: string) => {
    return PaymentService.getInstance().retryPayment(paymentId);
  }, []);

  const reset = useCallback(() => {
    PaymentService.getInstance().reset();
  }, []);

  return {
    // State
    state,
    isLoading: state.status === 'processing',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    error: state.error,
    paymentId: state.paymentId,
    checkoutUrl: state.checkoutUrl,
    
    // Actions
    processPayment,
    walletTopup,
    walletPayment,
    rentContent,
    purchaseContent,
    getPaymentHistory,
    verifyPayment,
    retryPayment,
    reset,

    // Utilities
    openCheckout: PaymentService.getInstance().openCheckout.bind(PaymentService.getInstance())
  };
};
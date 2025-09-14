import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface PaymentIntent {
  amount: number;
  currency?: string;
  purpose: 'wallet_topup' | 'rental' | 'purchase' | 'subscription';
  metadata?: any;
}

export interface PaymentResult {
  success: boolean;
  payment_id?: string;
  checkout_url?: string;
  error?: string;
}

export const usePayments = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { user, profile } = useAuth();

  const createPaymentIntent = async (intent: PaymentIntent): Promise<PaymentResult> => {
    if (!user || !profile) {
      throw new Error('User must be authenticated');
    }

    setIsLoading(true);
    try {
      const idempotencyKey = `${intent.purpose}_${user.id}_${Date.now()}_${Math.random()}`;

      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          ...intent,
          email: profile.email
        },
        headers: {
          'idempotency-key': idempotencyKey
        }
      });

      if (error) {
        console.error('Payment intent error:', error);
        throw new Error(error.message || 'Failed to create payment intent');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to create payment intent');
      }

      return {
        success: true,
        payment_id: data.payment_id,
        checkout_url: data.paystack.authorization_url
      };
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      setIsLoading(false);
    }
  };

  const walletTopup = async (amount: number): Promise<PaymentResult> => {
    if (!user || !profile) {
      throw new Error('User must be authenticated');
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-topup', {
        body: {
          amount,
          email: profile.email
        }
      });

      if (error) {
        console.error('Wallet topup error:', error);
        throw new Error(error.message || 'Failed to initiate wallet topup');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to initiate wallet topup');
      }

      return {
        success: true,
        payment_id: data.payment_id,
        checkout_url: data.checkout_url
      };
    } catch (error: any) {
      console.error('Error with wallet topup:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPayment = async (paymentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: {},
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      throw error;
    }
  };

  const processRental = async (contentId: string, contentType: 'movie' | 'episode', amount: number, rentalDuration: number = 48) => {
    return createPaymentIntent({
      amount: amount * 100, // Convert to kobo
      purpose: 'rental',
      metadata: {
        content_id: contentId,
        content_type: contentType,
        rental_duration: rentalDuration
      }
    });
  };

  const processPurchase = async (contentId: string, contentType: 'movie' | 'episode', amount: number) => {
    return createPaymentIntent({
      amount: amount * 100, // Convert to kobo
      purpose: 'purchase',
      metadata: {
        content_id: contentId,
        content_type: contentType
      }
    });
  };

  const openPaystackCheckout = (checkoutUrl: string) => {
    // Open Paystack checkout in a new tab
    const popup = window.open(checkoutUrl, '_blank', 'width=500,height=700');
    
    // Optional: Listen for the popup to close and verify payment
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        toast({
          title: "Payment Window Closed",
          description: "Please check your email for payment confirmation.",
        });
      }
    }, 1000);

    return popup;
  };

  return {
    createPaymentIntent,
    walletTopup,
    verifyPayment,
    processRental,
    processPurchase,
    openPaystackCheckout,
    isLoading
  };
};
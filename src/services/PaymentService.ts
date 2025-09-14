// Unified Payment Service - Phase 1 & 2 Implementation
import { supabase } from '@/integrations/supabase/client';

export type PaymentStatus = 'idle' | 'processing' | 'success' | 'error' | 'cancelled';

export interface PaymentState {
  status: PaymentStatus;
  error: string | null;
  paymentId: string | null;
  checkoutUrl: string | null;
  walletTransactionId: string | null;
}

export interface PaymentRequest {
  amount: number;
  currency?: string;
  purpose: 'wallet_topup' | 'rental' | 'purchase' | 'subscription';
  metadata?: any;
  paymentMethod?: 'card' | 'wallet';
}

export interface PaymentResult {
  success: boolean;
  payment_id?: string;
  checkout_url?: string;
  wallet_transaction_id?: string;
  error?: string;
}

export class PaymentService {
  private static instance: PaymentService;
  private listeners: Set<(state: PaymentState) => void> = new Set();
  private currentState: PaymentState = {
    status: 'idle',
    error: null,
    paymentId: null,
    checkoutUrl: null,
    walletTransactionId: null
  };

  static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  // State Management
  subscribe(listener: (state: PaymentState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(newState: Partial<PaymentState>) {
    this.currentState = { ...this.currentState, ...newState };
    this.listeners.forEach(listener => listener(this.currentState));
  }

  getState(): PaymentState {
    return { ...this.currentState };
  }

  // Main Payment Processing - UNIFIED ONLY
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    this.setState({ status: 'processing', error: null });

    try {
      const session = await supabase.auth.getSession();
      const user = session.data.session?.user;

      if (!user) {
        throw new Error('User must be authenticated');
      }

      // Get user profile for email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', user.id)
        .single();

      if (!profile?.email) {
        throw new Error('User email not found');
      }

      const idempotencyKey = this.generateIdempotencyKey(request, user.id);
      
      // Convert amounts to kobo consistently
      const body = {
        ...request,
        amount: Math.round(request.amount * 100), // Always convert to kobo for backend
        email: profile.email
      };

      const { data, error } = await supabase.functions.invoke('unified-payment', {
        body,
        headers: {
          'idempotency-key': idempotencyKey,
          'Content-Type': 'application/json'
        }
      });

      if (error) {
        throw new Error(error.message || 'Payment failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Payment processing failed');
      }

      const result: PaymentResult = {
        success: true,
        payment_id: data.payment_id,
        checkout_url: data.checkout_url,
        wallet_transaction_id: data.wallet_transaction_id
      };

      this.setState({
        status: 'success',
        paymentId: result.payment_id || null,
        checkoutUrl: result.checkout_url || null,
        walletTransactionId: result.wallet_transaction_id || null
      });

      // Open checkout if URL provided
      if (result.checkout_url) {
        this.openCheckout(result.checkout_url);
      }

      return result;

    } catch (error: any) {
      this.setState({
        status: 'error',
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Convenience Methods - Fixed Amount Handling
  async walletTopup(amount: number): Promise<PaymentResult> {
    return this.processPayment({
      amount, // Amount already in NGN
      purpose: 'wallet_topup',
      paymentMethod: 'card'
    });
  }

  async walletPayment(amount: number, purpose: 'rental' | 'purchase', metadata?: any): Promise<PaymentResult> {
    return this.processPayment({
      amount, // Amount already in NGN
      purpose,
      metadata,
      paymentMethod: 'wallet'
    });
  }

  async rentContent(contentId: string, contentType: 'movie' | 'episode', amount: number, rentalDuration = 48, paymentMethod: 'card' | 'wallet' = 'card'): Promise<PaymentResult> {
    return this.processPayment({
      amount, // Amount already in NGN
      purpose: 'rental',
      metadata: {
        content_id: contentId,
        content_type: contentType,
        rental_duration: rentalDuration
      },
      paymentMethod
    });
  }

  async purchaseContent(contentId: string, contentType: 'movie' | 'episode', amount: number, paymentMethod: 'card' | 'wallet' = 'card'): Promise<PaymentResult> {
    return this.processPayment({
      amount, // Amount already in NGN
      purpose: 'purchase',
      metadata: {
        content_id: contentId,
        content_type: contentType
      },
      paymentMethod
    });
  }

  // Payment History & Verification
  async getPaymentHistory(limit = 10) {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        wallet_transactions:wallet_transactions(*)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async verifyPayment(paymentId: string) {
    const { data, error } = await supabase.functions.invoke('verify-payment', {
      body: { payment_id: paymentId }
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  // Checkout Handling
  openCheckout(checkoutUrl: string): Window | null {
    const popup = window.open(
      checkoutUrl, 
      '_blank', 
      'width=500,height=700,scrollbars=yes,resizable=yes'
    );
    
    if (popup) {
      // Monitor popup closure
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          this.setState({ status: 'idle' });
        }
      }, 1000);
    }

    return popup;
  }

  // Retry Logic
  async retryPayment(paymentId: string): Promise<PaymentResult> {
    this.setState({ status: 'processing', error: null });

    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { payment_id: paymentId }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.payment?.enhanced_status === 'completed') {
        this.setState({ status: 'success', paymentId });
        return { success: true, payment_id: paymentId };
      } else {
        throw new Error('Payment not completed');
      }
    } catch (error: any) {
      this.setState({ status: 'error', error: error.message });
      return { success: false, error: error.message };
    }
  }

  // Reset State
  reset() {
    this.setState({
      status: 'idle',
      error: null,
      paymentId: null,
      checkoutUrl: null,
      walletTransactionId: null
    });
  }

  // Utility Methods
  private generateIdempotencyKey(request: PaymentRequest, userId: string): string {
    return `${request.purpose}_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
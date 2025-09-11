// Shared payment processing utilities
import { authenticateUser } from "./auth.ts";
import { validatePaymentAmount, validatePaymentPurpose, validateEmail, validateIdempotencyKey, sanitizeInput } from "./validation.ts";

export interface PaymentRequest {
  amount: number;
  currency?: string;
  purpose: string;
  metadata?: any;
  email: string;
  paymentMethod?: 'card' | 'wallet';
}

export interface PaymentResult {
  success: boolean;
  payment_id?: string;
  checkout_url?: string;
  error?: string;
  wallet_transaction_id?: string;
}

export class PaymentProcessor {
  private supabase: any;
  private user: any;

  constructor(supabase: any, user: any) {
    this.supabase = supabase;
    this.user = user;
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // Sanitize input
      const sanitized = sanitizeInput(request);
      
      // Validate input
      const validationErrors = this.validateRequest(sanitized);
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }

      // Determine payment flow
      if (sanitized.paymentMethod === 'wallet') {
        return await this.processWalletPayment(sanitized);
      } else {
        return await this.processCardPayment(sanitized);
      }
    } catch (error: any) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private validateRequest(request: PaymentRequest): string[] {
    const errors: string[] = [];

    const amountValidation = validatePaymentAmount(request.amount);
    if (!amountValidation.isValid) {
      errors.push(...amountValidation.errors);
    }

    const purposeValidation = validatePaymentPurpose(request.purpose);
    if (!purposeValidation.isValid) {
      errors.push(...purposeValidation.errors);
    }

    const emailValidation = validateEmail(request.email);
    if (!emailValidation.isValid) {
      errors.push(...emailValidation.errors);
    }

    return errors;
  }

  private async processWalletPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Get user's wallet
    const { data: wallet, error: walletError } = await this.supabase
      .from('wallets')
      .select('*')
      .eq('user_id', this.user.id)
      .single();

    if (walletError || !wallet) {
      throw new Error('User wallet not found');
    }

    const amount = request.amount / 100; // Convert from kobo to naira

    // Check sufficient balance
    if (wallet.balance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    // Create payment record
    const { data: payment, error: paymentError } = await this.supabase
      .from('payments')
      .insert({
        user_id: this.user.id,
        amount: amount,
        currency: request.currency || 'NGN',
        purpose: request.purpose,
        metadata: request.metadata || {},
        provider: 'wallet',
        enhanced_status: 'processing',
        transaction_type: request.purpose,
        flow_direction: 'internal'
      })
      .select()
      .single();

    if (paymentError) {
      throw new Error('Failed to create payment record');
    }

    try {
      // Process wallet transaction
      const transactionId = await this.supabase.rpc('process_wallet_transaction', {
        p_wallet_id: wallet.wallet_id,
        p_amount: amount,
        p_type: 'debit',
        p_description: `Payment for ${request.purpose}`,
        p_payment_id: payment.id,
        p_metadata: request.metadata || {}
      });

      // Update payment status
      await this.supabase
        .from('payments')
        .update({
          enhanced_status: 'completed',
          status: 'success'
        })
        .eq('id', payment.id);

      // Process the specific action (rental, purchase, etc.)
      await this.fulfillPayment(payment, request);

      return {
        success: true,
        payment_id: payment.id,
        wallet_transaction_id: transactionId
      };
    } catch (error: any) {
      // Rollback payment status
      await this.supabase
        .from('payments')
        .update({
          enhanced_status: 'failed',
          error_message: error.message
        })
        .eq('id', payment.id);

      throw error;
    }
  }

  private async processCardPayment(request: PaymentRequest): Promise<PaymentResult> {
    const idempotencyKey = `${request.purpose}_${this.user.id}_${Date.now()}_${Math.random()}`;

    // Create payment record
    const { data: payment, error: paymentError } = await this.supabase
      .from('payments')
      .insert({
        user_id: this.user.id,
        amount: request.amount / 100,
        currency: request.currency || 'NGN',
        purpose: request.purpose,
        metadata: request.metadata || {},
        provider: 'paystack',
        intent_id: idempotencyKey,
        enhanced_status: 'initiated',
        transaction_type: request.purpose,
        flow_direction: 'outbound'
      })
      .select()
      .single();

    if (paymentError) {
      throw new Error('Failed to create payment record');
    }

    // Initialize Paystack transaction
    const paystackResult = await this.initializePaystack(payment, request);
    
    if (!paystackResult.success) {
      await this.supabase
        .from('payments')
        .update({
          enhanced_status: 'failed',
          error_message: paystackResult.error
        })
        .eq('id', payment.id);
      
      throw new Error(paystackResult.error);
    }

    return {
      success: true,
      payment_id: payment.id,
      checkout_url: paystackResult.checkout_url
    };
  }

  private async initializePaystack(payment: any, request: PaymentRequest) {
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      throw new Error("Paystack secret key not configured");
    }

    try {
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: request.email,
          amount: request.amount,
          currency: request.currency || 'NGN',
          reference: payment.id,
          callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/paystack-webhook`,
          metadata: {
            ...request.metadata,
            payment_id: payment.id,
            user_id: this.user.id,
            purpose: request.purpose,
          },
        }),
      });

      const data = await response.json();

      if (!data.status) {
        return {
          success: false,
          error: data.message || 'Paystack initialization failed'
        };
      }

      // Update payment with Paystack reference
      await this.supabase
        .from('payments')
        .update({
          provider_reference: data.data.reference,
          enhanced_status: 'pending'
        })
        .eq('id', payment.id);

      return {
        success: true,
        checkout_url: data.data.authorization_url
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async fulfillPayment(payment: any, request: PaymentRequest) {
    const { purpose, metadata } = request;

    try {
      switch (purpose) {
        case 'rental':
          await this.fulfillRental(payment, metadata);
          break;
        case 'purchase':
          await this.fulfillPurchase(payment, metadata);
          break;
        case 'wallet_topup':
          // Already handled in wallet payment processing
          break;
        default:
          console.log(`No fulfillment logic for purpose: ${purpose}`);
      }
    } catch (error: any) {
      console.error('Payment fulfillment error:', error);
      throw error;
    }
  }

  private async fulfillRental(payment: any, metadata: any) {
    if (!metadata.content_id || !metadata.content_type) {
      throw new Error('Missing rental metadata');
    }

    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + (metadata.rental_duration || 48));

    await this.supabase
      .from('rentals')
      .insert({
        user_id: this.user.id,
        content_id: metadata.content_id,
        content_type: metadata.content_type,
        price_paid: payment.amount,
        expiration_date: expirationDate.toISOString(),
        status: 'active'
      });
  }

  private async fulfillPurchase(payment: any, metadata: any) {
    if (!metadata.content_id || !metadata.content_type) {
      throw new Error('Missing purchase metadata');
    }

    await this.supabase
      .from('purchases')
      .insert({
        user_id: this.user.id,
        content_id: metadata.content_id,
        content_type: metadata.content_type,
        price_paid: payment.amount
      });
  }
}
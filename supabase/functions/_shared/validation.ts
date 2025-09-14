// Shared validation utilities for edge functions

export interface PaymentValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validatePaymentAmount(amount: number): PaymentValidationResult {
  const errors: string[] = [];

  if (!amount || typeof amount !== 'number') {
    errors.push("Amount is required and must be a number");
  } else if (amount < 100) {
    errors.push("Amount must be at least 100 kobo (₦1.00)");
  } else if (amount > 100000000) { // 1 million naira in kobo
    errors.push("Amount exceeds maximum limit of ₦1,000,000");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validatePaymentPurpose(purpose: string): PaymentValidationResult {
  const validPurposes = ['wallet_topup', 'rental', 'purchase', 'subscription'];
  const errors: string[] = [];

  if (!purpose) {
    errors.push("Payment purpose is required");
  } else if (!validPurposes.includes(purpose)) {
    errors.push(`Invalid payment purpose. Must be one of: ${validPurposes.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateEmail(email: string): PaymentValidationResult {
  const errors: string[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) {
    errors.push("Email is required");
  } else if (!emailRegex.test(email)) {
    errors.push("Invalid email format");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateIdempotencyKey(key: string): PaymentValidationResult {
  const errors: string[] = [];

  if (!key) {
    errors.push("Idempotency key is required");
  } else if (key.length < 10) {
    errors.push("Idempotency key must be at least 10 characters");
  } else if (key.length > 255) {
    errors.push("Idempotency key must be less than 255 characters");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input.trim();
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
}
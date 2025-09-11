-- Phase 1: Enhanced Database Schema
-- Add wallet transaction history table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(wallet_id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'refund', 'fee')),
  description TEXT,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add payment attempts table for retry handling
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  provider_response JSONB DEFAULT '{}'::jsonb
);

-- Add payment flow direction and enhanced status tracking
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS flow_direction TEXT DEFAULT 'outbound' CHECK (flow_direction IN ('inbound', 'outbound', 'internal')),
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '1 hour');

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON public.wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_payment_id ON public.payment_attempts(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_expires_at ON public.payments(expires_at);
CREATE INDEX IF NOT EXISTS idx_payments_enhanced_status ON public.payments(enhanced_status);

-- Enable RLS on new tables
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for wallet_transactions
CREATE POLICY "Users can view their own wallet transactions" 
ON public.wallet_transactions FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.wallets w 
    WHERE w.wallet_id = wallet_transactions.wallet_id 
    AND w.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert wallet transactions" 
ON public.wallet_transactions FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Super admins can manage wallet transactions" 
ON public.wallet_transactions FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Policies for payment_attempts
CREATE POLICY "Users can view their own payment attempts" 
ON public.payment_attempts FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.payments p 
    WHERE p.id = payment_attempts.payment_id 
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "System can manage payment attempts" 
ON public.payment_attempts FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Super admins can view payment attempts" 
ON public.payment_attempts FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Function to handle wallet transactions
CREATE OR REPLACE FUNCTION public.process_wallet_transaction(
  p_wallet_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_payment_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance NUMERIC;
  new_balance NUMERIC;
  transaction_id UUID;
BEGIN
  -- Get current balance with row lock
  SELECT balance INTO current_balance
  FROM wallets
  WHERE wallet_id = p_wallet_id
  FOR UPDATE;

  -- Calculate new balance
  IF p_type = 'credit' THEN
    new_balance := current_balance + p_amount;
  ELSIF p_type = 'debit' THEN
    IF current_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;
    new_balance := current_balance - p_amount;
  ELSE
    RAISE EXCEPTION 'Invalid transaction type: %', p_type;
  END IF;

  -- Update wallet balance
  UPDATE wallets
  SET balance = new_balance, updated_at = now()
  WHERE wallet_id = p_wallet_id;

  -- Insert transaction record
  INSERT INTO wallet_transactions (
    wallet_id, payment_id, amount, transaction_type, description,
    balance_before, balance_after, metadata
  ) VALUES (
    p_wallet_id, p_payment_id, p_amount, p_type, p_description,
    current_balance, new_balance, p_metadata
  ) RETURNING id INTO transaction_id;

  RETURN transaction_id;
END;
$$;

-- Function to cleanup expired payments
CREATE OR REPLACE FUNCTION public.cleanup_expired_payments()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE payments
  SET enhanced_status = 'expired'
  WHERE enhanced_status IN ('initiated', 'pending')
    AND expires_at < now();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;
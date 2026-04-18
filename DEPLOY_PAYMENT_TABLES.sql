-- ============================================================================
-- RENTAL PAYMENT TABLES DEPLOYMENT
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/[PROJECT_ID]/sql
-- ============================================================================

-- ============================================================================
-- Step 1: Create rental_payments table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rental_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paystack_reference VARCHAR(255),
  paystack_access_code VARCHAR(255),
  amount BIGINT NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_channel VARCHAR(50) DEFAULT 'card',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- Step 2: Add indexes to rental_payments table
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_rental_payments_rental ON public.rental_payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_payments_paystack_ref ON public.rental_payments(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_rental_payments_channel ON public.rental_payments(payment_channel);
CREATE INDEX IF NOT EXISTS idx_rental_payments_status_channel ON public.rental_payments(payment_status, payment_channel);

-- ============================================================================
-- Step 3: Enable RLS on rental_payments table
-- ============================================================================

ALTER TABLE public.rental_payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 4: Create RLS Policies for rental_payments
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own payments" ON public.rental_payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON public.rental_payments;
DROP POLICY IF EXISTS "System can insert payments" ON public.rental_payments;
DROP POLICY IF EXISTS "System can update payments" ON public.rental_payments;

CREATE POLICY "Users can view their own payments"
  ON public.rental_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments"
  ON public.rental_payments FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "System can insert payments"
  ON public.rental_payments FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "System can update payments"
  ON public.rental_payments FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- Step 5: Create payment_anomalies table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_payment_id uuid NOT NULL REFERENCES public.rental_payments(id) ON DELETE CASCADE,
  paystack_reference text NOT NULL,
  anomaly_type text NOT NULL CHECK (anomaly_type IN ('dispute', 'refund', 'partial_payment', 'amount_mismatch', 'status_mismatch')),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
  message text NOT NULL,
  paystack_data jsonb,
  resolved boolean DEFAULT FALSE,
  resolution_notes text,
  created_at timestamp with time zone DEFAULT NOW(),
  resolved_at timestamp with time zone
);

-- ============================================================================
-- Step 6: Create indexes for payment_anomalies
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_payment_anomalies_severity ON public.payment_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_type ON public.payment_anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_resolved ON public.payment_anomalies(resolved);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_rental_payment_id ON public.payment_anomalies(rental_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_created_at ON public.payment_anomalies(created_at DESC);

-- ============================================================================
-- Step 7: Enable RLS on payment_anomalies
-- ============================================================================

ALTER TABLE public.payment_anomalies ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 8: Create RLS Policies for payment_anomalies
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all anomalies" ON public.payment_anomalies;
DROP POLICY IF EXISTS "Admins can update anomalies" ON public.payment_anomalies;
DROP POLICY IF EXISTS "Service role can insert anomalies" ON public.payment_anomalies;

-- Create new policies
CREATE POLICY "Admins can view all anomalies"
  ON public.payment_anomalies
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Admins can update anomalies"
  ON public.payment_anomalies
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Service role can insert anomalies"
  ON public.payment_anomalies
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- Verification Queries (run these after to verify)
-- ============================================================================

-- Verify rental_payments columns
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'rental_payments' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verify payment_anomalies table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'payment_anomalies' AND table_schema = 'public';

-- Verify payment_anomalies columns
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'payment_anomalies' AND table_schema = 'public'
ORDER BY ordinal_position;

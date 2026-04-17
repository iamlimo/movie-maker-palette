-- Create payment_anomalies table for tracking payment issues
CREATE TABLE IF NOT EXISTS public.payment_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_payment_id uuid NOT NULL REFERENCES public.rental_payments(id) ON DELETE CASCADE,
  paystack_reference text NOT NULL,
  anomaly_type text NOT NULL CHECK (anomaly_type IN ('dispute', 'refund', 'partial_payment', 'amount_mismatch', 'status_mismatch')),
  severity text NOT NULL CHECK (severity IN ('warning', 'critical')) DEFAULT 'warning',
  message text NOT NULL,
  paystack_data jsonb,
  resolved boolean DEFAULT FALSE,
  resolution_notes text,
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_severity ON public.payment_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_type ON public.payment_anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_resolved ON public.payment_anomalies(resolved);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_rental_payment_id ON public.payment_anomalies(rental_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_created_at ON public.payment_anomalies(created_at DESC);

-- Enable RLS
ALTER TABLE public.payment_anomalies ENABLE ROW LEVEL SECURITY;

-- RLS policies: Admins can view and update all anomalies
CREATE POLICY "Admins can view all anomalies"
  ON public.payment_anomalies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update anomalies"
  ON public.payment_anomalies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Service role can insert anomalies"
  ON public.payment_anomalies
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

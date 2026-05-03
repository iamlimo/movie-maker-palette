-- Create payment_anomalies table for tracking payment issues
CREATE TABLE IF NOT EXISTS payment_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_payment_id UUID NOT NULL REFERENCES rental_payments(id) ON DELETE CASCADE,
  paystack_reference TEXT NOT NULL,
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('dispute', 'refund', 'partial_payment', 'amount_mismatch', 'status_mismatch')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
  message TEXT NOT NULL,
  paystack_data JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_severity ON payment_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_type ON payment_anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_resolved ON payment_anomalies(resolved);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_rental_payment_id ON payment_anomalies(rental_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_created_at ON payment_anomalies(created_at DESC);

-- Enable RLS
ALTER TABLE payment_anomalies ENABLE ROW LEVEL SECURITY;

-- RLS policies: Admins can view and update all anomalies
CREATE POLICY "Admins can view all anomalies"
  ON payment_anomalies
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Admins can update anomalies"
  ON payment_anomalies
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
  ON payment_anomalies
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

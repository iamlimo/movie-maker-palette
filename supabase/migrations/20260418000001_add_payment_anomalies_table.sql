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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_severity ON payment_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_type ON payment_anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_resolved ON payment_anomalies(resolved);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_rental_payment_id ON payment_anomalies(rental_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_anomalies_created_at ON payment_anomalies(created_at DESC);

-- Enable RLS
ALTER TABLE payment_anomalies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow super_admin and admin to view all anomalies
CREATE POLICY "Allow admins to view payment anomalies" ON payment_anomalies
  FOR SELECT USING (
    auth.jwt() ->> 'role' IN ('super_admin', 'admin') OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'super_admin' OR profiles.role = 'admin')
    )
  );

-- Allow super_admin and admin to update anomalies (mark as resolved)
CREATE POLICY "Allow admins to update payment anomalies" ON payment_anomalies
  FOR UPDATE USING (
    auth.jwt() ->> 'role' IN ('super_admin', 'admin') OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'super_admin' OR profiles.role = 'admin')
    )
  );

-- Allow service role to insert anomalies (from edge function)
CREATE POLICY "Allow service role to insert anomalies" ON payment_anomalies
  FOR INSERT WITH CHECK (true);

-- Add payment tracking columns to rental_payments table
-- These columns support admin dashboard payment monitoring and Paystack channel tracking
-- Only applies if rental_payments table exists

-- Safely add columns if table exists
DO $$ 
BEGIN
  -- Check if rental_payments table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rental_payments') THEN
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rental_payments' AND column_name = 'payment_channel') THEN
      ALTER TABLE rental_payments ADD COLUMN payment_channel VARCHAR(50) DEFAULT 'card';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rental_payments' AND column_name = 'metadata') THEN
      ALTER TABLE rental_payments ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Update existing records to have 'card' as default channel
    UPDATE rental_payments 
    SET payment_channel = 'card' 
    WHERE payment_channel IS NULL;

    -- Create indexes if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'rental_payments' AND indexname = 'idx_rental_payments_channel') THEN
      CREATE INDEX idx_rental_payments_channel ON rental_payments(payment_channel);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'rental_payments' AND indexname = 'idx_rental_payments_status_channel') THEN
      CREATE INDEX idx_rental_payments_status_channel ON rental_payments(payment_status, payment_channel);
    END IF;

    -- Update RLS policies
    DROP POLICY IF EXISTS "Users can view their own payments" ON rental_payments;
    DROP POLICY IF EXISTS "Admins can view all payments" ON rental_payments;

    CREATE POLICY "Users can view their own payments"
      ON rental_payments FOR SELECT
      USING (auth.uid() = user_id);

    CREATE POLICY "Admins can view all payments"
      ON rental_payments FOR SELECT
      USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;


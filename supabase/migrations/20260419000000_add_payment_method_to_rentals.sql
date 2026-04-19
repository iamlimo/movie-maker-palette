-- Add payment_method column to rentals table to track payment method used
-- Supports 'wallet' and 'paystack' payment methods

DO $$ 
BEGIN
  -- Check if rentals table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rentals') THEN
    
    -- Add payment_method column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'payment_method') THEN
      ALTER TABLE rentals ADD COLUMN payment_method TEXT DEFAULT 'wallet' CHECK (payment_method IN ('wallet', 'paystack'));
      RAISE NOTICE 'Added payment_method column to rentals table';
    ELSE
      RAISE NOTICE 'payment_method column already exists in rentals table';
    END IF;

  ELSE
    RAISE EXCEPTION 'rentals table does not exist';
  END IF;
END $$;

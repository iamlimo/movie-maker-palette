-- Fix rentals table schema to use 'price' instead of 'amount'
-- This migration handles the schema conflict between older migrations

DO $$ 
BEGIN
  -- Check if rentals table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rentals') THEN
    
    -- If 'amount' column exists but 'price' doesn't, rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'amount') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'price') 
    THEN
      ALTER TABLE rentals RENAME COLUMN amount TO price;
      RAISE NOTICE 'Renamed amount column to price in rentals table';
    END IF;

    -- Add 'price' column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'price') THEN
      ALTER TABLE rentals ADD COLUMN price BIGINT DEFAULT 0;
      RAISE NOTICE 'Added price column to rentals table';
    ELSE
      RAISE NOTICE 'price column already exists in rentals table';
    END IF;

    -- Ensure discount_applied exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'discount_applied') THEN
      ALTER TABLE rentals ADD COLUMN discount_applied BIGINT DEFAULT 0;
      RAISE NOTICE 'Added discount_applied column to rentals table';
    END IF;

    -- Ensure final_price exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'final_price') THEN
      ALTER TABLE rentals ADD COLUMN final_price BIGINT DEFAULT 0;
      RAISE NOTICE 'Added final_price column to rentals table';
    END IF;

  ELSE
    RAISE EXCEPTION 'rentals table does not exist';
  END IF;
END $$;

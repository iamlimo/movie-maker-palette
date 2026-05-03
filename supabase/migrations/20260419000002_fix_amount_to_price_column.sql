-- Fix rentals table: rename 'amount' column to 'price' and remove any duplicates
-- This ensures consistency between the database schema and the process-rental function

DO $$ 
BEGIN
  -- Check if rentals table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rentals') THEN
    
    -- Step 1: If both 'amount' and 'price' columns exist, remove 'price' first (keep amount)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'amount')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'price')
    THEN
      ALTER TABLE rentals DROP COLUMN price;
      RAISE NOTICE 'Dropped duplicate price column';
    END IF;

    -- Step 2: Rename 'amount' to 'price' if amount exists and price doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'amount')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'price')
    THEN
      ALTER TABLE rentals RENAME COLUMN amount TO price;
      RAISE NOTICE 'Renamed amount column to price';
    END IF;

    -- Step 3: Ensure 'price' column exists with proper type and constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'price') THEN
      ALTER TABLE rentals ADD COLUMN price BIGINT NOT NULL DEFAULT 0;
      RAISE NOTICE 'Added price column to rentals table';
    ELSE
      RAISE NOTICE 'price column already exists in rentals table';
    END IF;

  ELSE
    RAISE EXCEPTION 'rentals table does not exist';
  END IF;
END $$;

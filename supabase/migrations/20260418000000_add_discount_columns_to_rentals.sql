-- Add discount_applied and final_price columns to rentals table
-- Uses DO block to safely add columns if they don't already exist

DO $$ 
BEGIN
  -- Check if rentals table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rentals') THEN
    -- Add discount_applied column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'discount_applied') THEN
      ALTER TABLE rentals ADD COLUMN discount_applied INTEGER DEFAULT 0;
      RAISE NOTICE 'Added discount_applied column to rentals table';
    ELSE
      RAISE NOTICE 'discount_applied column already exists in rentals table';
    END IF;

    -- Add final_price column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'final_price') THEN
      ALTER TABLE rentals ADD COLUMN final_price INTEGER DEFAULT 0;
      RAISE NOTICE 'Added final_price column to rentals table';
    ELSE
      RAISE NOTICE 'final_price column already exists in rentals table';
    END IF;

    -- Create index on final_price if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'rentals' AND indexname = 'idx_rentals_final_price') THEN
      CREATE INDEX idx_rentals_final_price ON rentals(final_price);
      RAISE NOTICE 'Created index idx_rentals_final_price';
    ELSE
      RAISE NOTICE 'Index idx_rentals_final_price already exists';
    END IF;

    -- Update existing records to set final_price = price if not set
    UPDATE rentals 
    SET final_price = price 
    WHERE final_price = 0 AND price > 0;
    
    RAISE NOTICE 'Updated existing rentals records with final_price';
  ELSE
    RAISE EXCEPTION 'rentals table does not exist';
  END IF;
END $$;

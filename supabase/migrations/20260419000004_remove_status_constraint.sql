-- Remove status check constraint that was causing conflicts
-- Allow application-level validation instead

DO $$ 
BEGIN
  -- Check if rentals table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rentals') THEN
    
    -- Drop any existing status check constraints
    BEGIN
      ALTER TABLE rentals DROP CONSTRAINT IF EXISTS rentals_status_check;
      RAISE NOTICE 'Dropped status check constraint from rentals table';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'No constraint to drop or constraint drop failed: %', SQLERRM;
    END;

  ELSE
    RAISE EXCEPTION 'rentals table does not exist';
  END IF;
END $$;

-- Fix rentals table status check constraint
-- Remove conflicting constraint to allow all rental status values

DO $$ 
BEGIN
  -- Check if rentals table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rentals') THEN
    
    -- Drop any existing status check constraints that might conflict
    BEGIN
      ALTER TABLE rentals DROP CONSTRAINT IF EXISTS rentals_status_check;
      RAISE NOTICE 'Dropped existing status check constraint';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error dropping constraint (may not exist): %', SQLERRM;
    END;

  ELSE
    RAISE EXCEPTION 'rentals table does not exist';
  END IF;
END $$;

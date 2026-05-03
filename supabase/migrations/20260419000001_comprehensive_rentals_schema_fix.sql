-- Comprehensive rental table schema fix
-- Ensures all required columns exist with proper types and constraints

DO $$ 
BEGIN
  -- Check if rentals table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rentals') THEN
    
    -- Add id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'id') THEN
      ALTER TABLE rentals ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
      RAISE NOTICE 'Added id column to rentals table';
    END IF;

    -- Add user_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'user_id') THEN
      ALTER TABLE rentals ADD COLUMN user_id UUID NOT NULL;
      RAISE NOTICE 'Added user_id column to rentals table';
    END IF;

    -- Add content_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'content_id') THEN
      ALTER TABLE rentals ADD COLUMN content_id UUID NOT NULL;
      RAISE NOTICE 'Added content_id column to rentals table';
    END IF;

    -- Add content_type column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'content_type') THEN
      ALTER TABLE rentals ADD COLUMN content_type TEXT NOT NULL;
      RAISE NOTICE 'Added content_type column to rentals table';
    END IF;

    -- Add price column if missing (in kobo - smallest currency unit)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'price') THEN
      ALTER TABLE rentals ADD COLUMN price BIGINT NOT NULL DEFAULT 0;
      RAISE NOTICE 'Added price column to rentals table';
    ELSE
      RAISE NOTICE 'price column already exists in rentals table';
    END IF;

    -- Add payment_method column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'payment_method') THEN
      ALTER TABLE rentals ADD COLUMN payment_method TEXT DEFAULT 'wallet' CHECK (payment_method IN ('wallet', 'paystack'));
      RAISE NOTICE 'Added payment_method column to rentals table';
    ELSE
      RAISE NOTICE 'payment_method column already exists in rentals table';
    END IF;

    -- Add status column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'status') THEN
      ALTER TABLE rentals ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'expired'));
      RAISE NOTICE 'Added status column to rentals table';
    ELSE
      RAISE NOTICE 'status column already exists in rentals table';
    END IF;

    -- Add expires_at column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'expires_at') THEN
      ALTER TABLE rentals ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE NOT NULL;
      RAISE NOTICE 'Added expires_at column to rentals table';
    ELSE
      RAISE NOTICE 'expires_at column already exists in rentals table';
    END IF;

    -- Add created_at column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'created_at') THEN
      ALTER TABLE rentals ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
      RAISE NOTICE 'Added created_at column to rentals table';
    ELSE
      RAISE NOTICE 'created_at column already exists in rentals table';
    END IF;

    -- Update content_type check constraint to support all content types
    BEGIN
      ALTER TABLE rentals DROP CONSTRAINT IF EXISTS rentals_content_type_check;
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;
    
    ALTER TABLE rentals ADD CONSTRAINT rentals_content_type_check 
      CHECK (content_type IN ('movie', 'tv', 'episode', 'season'));
    RAISE NOTICE 'Updated content_type constraint';

  ELSE
    RAISE EXCEPTION 'rentals table does not exist';
  END IF;
END $$;

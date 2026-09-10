-- Make phone_number required on profiles table
-- This ensures all users must provide a phone number during signup

-- Step 1: Set default empty string for any existing NULL values
UPDATE public.profiles
SET phone_number = ''
WHERE phone_number IS NULL;

-- Step 2: Add NOT NULL constraint
ALTER TABLE public.profiles
ALTER COLUMN phone_number SET NOT NULL;

-- Step 3: Add default empty string for future inserts (backup safety measure)
ALTER TABLE public.profiles
ALTER COLUMN phone_number SET DEFAULT '';

-- Step 4: Update the handle_new_user trigger to ensure phone_number is never empty
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_phone text;
BEGIN
  v_name  := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone_number', '');
  
  -- Reject signup if phone_number is empty (on mobile apps, this should never happen due to validation)
  IF v_phone = '' THEN
    RAISE EXCEPTION 'Phone number is required for account creation';
  END IF;

  INSERT INTO public.profiles (user_id, name, email, phone_number, created_at, updated_at)
  VALUES (NEW.id, v_name, NEW.email, v_phone, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        phone_number = EXCLUDED.phone_number,
        updated_at = now();

  INSERT INTO public.wallets (user_id, balance, created_at, updated_at)
  VALUES (NEW.id, 0, now(), now())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 400 NGN signup bonus (idempotent via reference)
  PERFORM public.grant_signup_bonus(NEW.id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

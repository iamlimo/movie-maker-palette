-- Fix phone backfill and trigger for onboarding users
-- This makes the phone-number sync permanent and idempotent.

-- 1) Backfill missing phone numbers from auth metadata
UPDATE public.profiles p
SET phone_number = up.phone
FROM (
  SELECT
    u.id AS user_id,
    COALESCE(
      NULLIF(u.raw_user_meta_data->>'phone_number', ''),
      NULLIF(u.raw_user_meta_data->>'phone', ''),
      NULLIF(u.raw_user_meta_data->>'phoneNumber', ''),
      NULLIF(u.raw_user_meta_data->>'mobile', ''),
      ''
    ) AS phone
  FROM auth.users u
) up
WHERE p.user_id = up.user_id
  AND (p.phone_number IS NULL OR p.phone_number = '')
  AND up.phone <> '';

-- 2) Clean up any remaining null/blank values
UPDATE public.profiles
SET phone_number = ''
WHERE phone_number IS NULL;

-- 3) Ensure phone_number is safe for future inserts
ALTER TABLE public.profiles
ALTER COLUMN phone_number SET DEFAULT '';

ALTER TABLE public.profiles
ALTER COLUMN phone_number SET NOT NULL;

-- 4) Recreate the trigger function to keep phone sync working for all future signups
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
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1),
    'User'
  );

  v_phone := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'phone_number', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'phoneNumber', ''),
    NULLIF(NEW.raw_user_meta_data->>'mobile', ''),
    ''
  );

  INSERT INTO public.profiles (
    user_id,
    name,
    email,
    phone_number,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_name,
    NEW.email,
    v_phone,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.profiles.name),
        phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
        updated_at = now();

  INSERT INTO public.wallets (user_id, balance, created_at, updated_at)
  VALUES (NEW.id, 0, now(), now())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM public.grant_signup_bonus(NEW.id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 5) Ensure the trigger is attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

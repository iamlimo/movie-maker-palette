-- Add optional gender data for signup profiles.
-- Allowed values are intentionally limited to Male/Female for this signup flow.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_gender_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_gender_check
      CHECK (gender IS NULL OR gender IN ('male', 'female'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.gender IS
  'Optional user-selected gender. Stored as male or female.';

-- Keep profile creation in sync with Supabase auth metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_phone text;
  v_gender text;
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

  v_gender := lower(trim(COALESCE(NEW.raw_user_meta_data->>'gender', '')));
  IF v_gender NOT IN ('male', 'female') THEN
    v_gender := NULL;
  END IF;

  INSERT INTO public.profiles (
    user_id,
    name,
    email,
    phone_number,
    gender,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_name,
    NEW.email,
    v_phone,
    v_gender,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.profiles.name),
        phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
        gender = COALESCE(EXCLUDED.gender, public.profiles.gender),
        updated_at = now();

  INSERT INTO public.wallets (user_id, balance, created_at, updated_at)
  VALUES (NEW.id, 0, now(), now())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM public.grant_signup_bonus(NEW.id);

  BEGIN
    PERFORM public.ensure_user_referral_code(NEW.id);
    PERFORM public.attach_referral(NEW.id, NEW.raw_user_meta_data->>'referral_code');
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'referral attach error: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

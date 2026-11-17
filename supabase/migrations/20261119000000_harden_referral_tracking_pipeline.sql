-- Harden the referral tracking pipeline by reattaching the signup trigger and ensuring
-- every profile has a referral code before any referral attribution is used.

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

INSERT INTO public.user_referral_codes (user_id, code)
SELECT p.user_id, public.ensure_user_referral_code(p.user_id)
FROM public.profiles p
LEFT JOIN public.user_referral_codes urc ON urc.user_id = p.user_id
WHERE urc.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- The reward pipeline has several transaction types that older migrations may not
-- have included in the wallet_transactions check constraint.
ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_transaction_type_check;
ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'credit', 'debit', 'rental', 'purchase', 'wallet_topup',
    'signup_bonus', 'referral_bonus', 'reward_voucher', 'WATCH_HOURS_REWARD'
  ));

-- Make referral attribution and first-purchase rewards durable across signup and payment paths.

CREATE OR REPLACE FUNCTION public.attach_referral(p_referred_id uuid, p_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_referrer uuid; v_p1 text; v_p2 text;
BEGIN
  IF p_referred_id IS NULL OR p_code IS NULL OR length(trim(p_code)) = 0 THEN RETURN; END IF;
  SELECT user_id INTO v_referrer
  FROM public.user_referral_codes
  WHERE upper(code) = upper(trim(p_code))
  LIMIT 1;
  IF v_referrer IS NULL OR v_referrer = p_referred_id THEN RETURN; END IF;

  SELECT regexp_replace(coalesce(phone_number,''),'\D','','g') INTO v_p1
  FROM public.profiles WHERE user_id = v_referrer;
  SELECT regexp_replace(coalesce(phone_number,''),'\D','','g') INTO v_p2
  FROM public.profiles WHERE user_id = p_referred_id;
  IF v_p1 <> '' AND v_p1 <> '' AND right(v_p1,10) = right(coalesce(v_p2,''),10) THEN RETURN; END IF;

  INSERT INTO public.user_referrals(referrer_id, referred_id, code)
  VALUES (v_referrer, p_referred_id, upper(trim(p_code)))
  ON CONFLICT (referred_id) DO UPDATE
    SET code = EXCLUDED.code,
        referrer_id = CASE WHEN public.user_referrals.status = 'pending' THEN EXCLUDED.referrer_id ELSE public.user_referrals.referrer_id END;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_phone text;
  v_referral text;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(coalesce(NEW.email,''), '@', 1), 'User');
  v_phone := COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone_number',''), NULLIF(NEW.raw_user_meta_data->>'phone',''), NULLIF(NEW.raw_user_meta_data->>'phoneNumber',''), NULLIF(NEW.raw_user_meta_data->>'mobile',''), '');

  INSERT INTO public.profiles (user_id, name, email, phone_number, created_at, updated_at)
  VALUES (NEW.id, v_name, NEW.email, v_phone, now(), now())
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    phone_number = COALESCE(NULLIF(EXCLUDED.phone_number,''), public.profiles.phone_number),
    updated_at = now();

  INSERT INTO public.wallets (user_id, balance, created_at, updated_at)
  VALUES (NEW.id, 0, now(), now()) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;

  BEGIN
    PERFORM public.grant_signup_bonus(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'signup bonus error: %', SQLERRM;
  END;

  BEGIN
    PERFORM public.ensure_user_referral_code(NEW.id);
    v_referral := COALESCE(NULLIF(NEW.raw_user_meta_data->>'referral_code',''), NULLIF(NEW.raw_user_meta_data->>'referralCode',''), NULLIF(NEW.raw_user_meta_data->>'referral',''), NULLIF(NEW.raw_user_meta_data->>'ref',''));
    PERFORM public.attach_referral(NEW.id, v_referral);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'referral attach error: %', SQLERRM;
  END;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill personal codes and referral rows for existing/auth users.
INSERT INTO public.user_referral_codes (user_id, code)
SELECT p.user_id, public.ensure_user_referral_code(p.user_id)
FROM public.profiles p
LEFT JOIN public.user_referral_codes urc ON urc.user_id = p.user_id
WHERE urc.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

DO $$
DECLARE u record; v_code text;
BEGIN
  FOR u IN
    SELECT id,
      coalesce(NULLIF(raw_user_meta_data->>'referral_code',''), NULLIF(raw_user_meta_data->>'referralCode',''), NULLIF(raw_user_meta_data->>'referral',''), NULLIF(raw_user_meta_data->>'ref','')) AS code
    FROM auth.users
  LOOP
    PERFORM public.ensure_user_referral_code(u.id);
    IF u.code IS NOT NULL THEN
      PERFORM public.attach_referral(u.id, u.code);
    END IF;
  END LOOP;
END $$;

-- Ensure every paid rental reliably fires the reward trigger.
CREATE OR REPLACE FUNCTION public.handle_rental_paid_rewards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NEW.status <> 'paid' OR (TG_OP = 'UPDATE' AND OLD.status = 'paid') OR COALESCE(NEW.price,0) <= 0 THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.reward_vouchers(user_id, source_intent_id, amount, expires_at)
    VALUES (NEW.user_id, NEW.id, 15000, now() + interval '7 days')
    ON CONFLICT (source_intent_id) DO NOTHING;

    SELECT * INTO r FROM public.user_referrals
    WHERE referred_id = NEW.user_id AND status = 'pending'
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.user_referrals
      SET status = 'qualified', qualifying_intent_id = NEW.id, qualified_at = now(),
          referrer_reward = 10000, referred_reward = 0
      WHERE id = r.id;

      PERFORM public.reward_credit_wallet(r.referrer_id, 10000,
        'referral_reward:referrer:' || r.id, 'referral_bonus',
        'Referral reward - your friend made their first rental',
        jsonb_build_object('referral_id', r.id, 'withdrawable', false));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'rental reward error: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rental_paid_rewards ON public.rental_intents;
CREATE TRIGGER trg_rental_paid_rewards
AFTER INSERT OR UPDATE OF status ON public.rental_intents
FOR EACH ROW EXECUTE FUNCTION public.handle_rental_paid_rewards();

-- Repair previously missed qualifications for paid rental intents.
DO $$
DECLARE r record; ri record;
BEGIN
  FOR r IN SELECT * FROM public.user_referrals WHERE status = 'pending' LOOP
    SELECT * INTO ri FROM public.rental_intents
    WHERE user_id = r.referred_id AND status = 'paid' AND COALESCE(price,0) > 0
    ORDER BY coalesce(paid_at, created_at) ASC LIMIT 1;
    IF FOUND THEN
      UPDATE public.user_referrals
      SET status='qualified', qualifying_intent_id=ri.id, qualified_at=now(),
          referrer_reward=10000, referred_reward=0
      WHERE id=r.id;
      PERFORM public.reward_credit_wallet(r.referrer_id, 10000,
        'referral_reward:referrer:' || r.id, 'referral_bonus',
        'Referral reward - your friend made their first rental',
        jsonb_build_object('referral_id', r.id, 'withdrawable', false));
    END IF;
  END LOOP;
END $$;

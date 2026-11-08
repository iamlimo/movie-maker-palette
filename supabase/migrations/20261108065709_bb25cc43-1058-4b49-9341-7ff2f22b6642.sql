
-- Generic idempotent wallet credit (reference-based)
CREATE OR REPLACE FUNCTION public.reward_credit_wallet(p_user_id uuid, p_amount bigint, p_reference text, p_type text, p_description text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet uuid; v_bal numeric; v_tx uuid;
BEGIN
  SELECT wallet_id, balance INTO v_wallet, v_bal FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN v_wallet := public.ensure_wallet_for_user(p_user_id); v_bal := 0; END IF;
  INSERT INTO public.wallet_transactions(wallet_id,user_id,transaction_type,amount,reference,description,metadata,balance_before,balance_after,created_at)
  VALUES (v_wallet,p_user_id,p_type,p_amount,p_reference,p_description,COALESCE(p_metadata,'{}'::jsonb),COALESCE(v_bal,0),COALESCE(v_bal,0)+p_amount,now())
  ON CONFLICT (reference) DO NOTHING RETURNING id INTO v_tx;
  IF v_tx IS NULL THEN RETURN NULL; END IF;
  UPDATE public.wallets SET balance = balance + p_amount, updated_at = now() WHERE wallet_id = v_wallet;
  RETURN v_tx;
END $$;
REVOKE ALL ON FUNCTION public.reward_credit_wallet(uuid,bigint,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;

-- Repair credit_wallet (it pointed to a removed overload)
CREATE OR REPLACE FUNCTION public.credit_wallet(p_wallet_id uuid, p_amount bigint, p_type text, p_reference text DEFAULT NULL, p_description text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb, p_user_id uuid DEFAULT NULL, p_payment_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_user uuid; v_bal numeric; v_tx uuid; v_ref text;
BEGIN
  SELECT user_id, balance INTO v_user, v_bal FROM public.wallets WHERE wallet_id = p_wallet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found: %', p_wallet_id; END IF;
  v_ref := COALESCE(p_reference, 'TXN-' || encode(gen_random_bytes(6),'hex'));
  INSERT INTO public.wallet_transactions(wallet_id,user_id,transaction_type,amount,reference,description,metadata,payment_id,balance_before,balance_after,created_at)
  VALUES (p_wallet_id,COALESCE(p_user_id,v_user),COALESCE(p_type,'credit'),p_amount,v_ref,COALESCE(p_description,'wallet credit'),COALESCE(p_metadata,'{}'::jsonb),p_payment_id,COALESCE(v_bal,0),COALESCE(v_bal,0)+p_amount,now())
  ON CONFLICT (reference) DO NOTHING RETURNING id INTO v_tx;
  IF v_tx IS NULL THEN RETURN NULL; END IF;
  UPDATE public.wallets SET balance = balance + p_amount, updated_at = now() WHERE wallet_id = p_wallet_id;
  RETURN v_tx;
END $$;

-- Personal referral codes
CREATE TABLE public.user_referral_codes (
  user_id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_referral_codes TO authenticated;
GRANT ALL ON public.user_referral_codes TO service_role;
ALTER TABLE public.user_referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own referral code" ON public.user_referral_codes FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.user_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL UNIQUE,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  qualifying_intent_id uuid,
  referrer_reward bigint NOT NULL DEFAULT 0,
  referred_reward bigint NOT NULL DEFAULT 0,
  qualified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_referrals TO authenticated;
GRANT ALL ON public.user_referrals TO service_role;
ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own referrals" ON public.user_referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER trg_user_referrals_updated BEFORE UPDATE ON public.user_referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Next-rental reward vouchers
CREATE TABLE public.reward_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_intent_id uuid UNIQUE,
  amount bigint NOT NULL,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_vouchers TO authenticated;
GRANT ALL ON public.reward_vouchers TO service_role;
ALTER TABLE public.reward_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own vouchers" ON public.reward_vouchers FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER trg_reward_vouchers_updated BEFORE UPDATE ON public.reward_vouchers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_reward_vouchers_user ON public.reward_vouchers(user_id, status);
CREATE INDEX idx_user_referrals_referrer ON public.user_referrals(referrer_id);

-- Code generator
CREATE OR REPLACE FUNCTION public.ensure_user_referral_code(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_code text; i int := 0;
BEGIN
  SELECT code INTO v_code FROM public.user_referral_codes WHERE user_id = p_user_id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  LOOP
    v_code := 'SIG-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,6));
    BEGIN
      INSERT INTO public.user_referral_codes(user_id, code) VALUES (p_user_id, v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      SELECT code INTO v_code FROM public.user_referral_codes WHERE user_id = p_user_id;
      IF v_code IS NOT NULL THEN RETURN v_code; END IF;
      i := i + 1; IF i > 10 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_my_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN public.ensure_user_referral_code(auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.ensure_user_referral_code(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referral_code() TO authenticated;

-- Attribution (anti-abuse: no self referral, no same phone)
CREATE OR REPLACE FUNCTION public.attach_referral(p_referred_id uuid, p_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_referrer uuid; v_p1 text; v_p2 text;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN RETURN; END IF;
  SELECT user_id INTO v_referrer FROM public.user_referral_codes WHERE code = upper(trim(p_code));
  IF v_referrer IS NULL OR v_referrer = p_referred_id THEN RETURN; END IF;
  SELECT regexp_replace(coalesce(phone_number,''),'\D','','g') INTO v_p1 FROM public.profiles WHERE user_id = v_referrer;
  SELECT regexp_replace(coalesce(phone_number,''),'\D','','g') INTO v_p2 FROM public.profiles WHERE user_id = p_referred_id;
  IF v_p1 <> '' AND right(v_p1,10) = right(v_p2,10) THEN RETURN; END IF;
  INSERT INTO public.user_referrals(referrer_id, referred_id, code) VALUES (v_referrer, p_referred_id, upper(trim(p_code)))
  ON CONFLICT (referred_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.attach_referral(uuid,text) FROM PUBLIC, anon, authenticated;

-- Hook attribution + code into signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_name text; v_phone text;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'User');
  v_phone := COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone_number',''), NULLIF(NEW.raw_user_meta_data->>'phone',''), NULLIF(NEW.raw_user_meta_data->>'phoneNumber',''), NULLIF(NEW.raw_user_meta_data->>'mobile',''), '');
  INSERT INTO public.profiles (user_id, name, email, phone_number, created_at, updated_at)
  VALUES (NEW.id, v_name, NEW.email, v_phone, now(), now())
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, name = COALESCE(EXCLUDED.name, public.profiles.name), phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number), updated_at = now();
  INSERT INTO public.wallets (user_id, balance, created_at, updated_at) VALUES (NEW.id, 0, now(), now()) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  PERFORM public.grant_signup_bonus(NEW.id);
  BEGIN
    PERFORM public.ensure_user_referral_code(NEW.id);
    PERFORM public.attach_referral(NEW.id, NEW.raw_user_meta_data->>'referral_code');
  EXCEPTION WHEN OTHERS THEN RAISE LOG 'referral attach error: %', SQLERRM;
  END;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Rewards on paid rental
CREATE OR REPLACE FUNCTION public.handle_rental_paid_rewards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NEW.status <> 'paid' OR (TG_OP = 'UPDATE' AND OLD.status = 'paid') OR COALESCE(NEW.price,0) <= 0 THEN RETURN NEW; END IF;
  BEGIN
    INSERT INTO public.reward_vouchers(user_id, source_intent_id, amount, expires_at)
    VALUES (NEW.user_id, NEW.id, 15000, now() + interval '7 days') ON CONFLICT (source_intent_id) DO NOTHING;

    SELECT * INTO r FROM public.user_referrals WHERE referred_id = NEW.user_id AND status = 'pending' FOR UPDATE;
    IF FOUND THEN
      UPDATE public.user_referrals SET status='qualified', qualifying_intent_id=NEW.id, qualified_at=now(), referrer_reward=20000, referred_reward=20000 WHERE id = r.id;
      PERFORM public.reward_credit_wallet(r.referrer_id, 20000, 'referral_reward:referrer:'||r.id, 'referral_bonus', 'Referral reward - your friend made their first rental', jsonb_build_object('referral_id', r.id, 'withdrawable', false));
      PERFORM public.reward_credit_wallet(r.referred_id, 20000, 'referral_reward:referred:'||r.id, 'referral_bonus', 'Referral reward - first rental bonus', jsonb_build_object('referral_id', r.id, 'withdrawable', false));
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE LOG 'rental reward error: %', SQLERRM;
  END;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_rental_paid_rewards AFTER INSERT OR UPDATE OF status ON public.rental_intents FOR EACH ROW EXECUTE FUNCTION public.handle_rental_paid_rewards();

-- Claim voucher into wallet
CREATE OR REPLACE FUNCTION public.claim_reward_voucher(p_voucher_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record;
BEGIN
  SELECT * INTO v FROM public.reward_vouchers WHERE id = p_voucher_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voucher not found'; END IF;
  IF v.status <> 'active' THEN RAISE EXCEPTION 'Voucher already used'; END IF;
  IF v.expires_at < now() THEN UPDATE public.reward_vouchers SET status='expired' WHERE id=v.id; RAISE EXCEPTION 'Voucher expired'; END IF;
  UPDATE public.reward_vouchers SET status='claimed', claimed_at=now() WHERE id=v.id;
  PERFORM public.reward_credit_wallet(v.user_id, v.amount, 'reward_voucher:'||v.id, 'reward_voucher', 'Next-rental reward credit', jsonb_build_object('voucher_id', v.id, 'withdrawable', false));
  RETURN v.amount;
END $$;
GRANT EXECUTE ON FUNCTION public.claim_reward_voucher(uuid) TO authenticated;

-- Backfill codes for existing users
INSERT INTO public.user_referral_codes(user_id, code)
SELECT p.user_id, 'SIG-' || upper(substr(md5(p.user_id::text || random()::text),1,6))
FROM public.profiles p ON CONFLICT DO NOTHING;

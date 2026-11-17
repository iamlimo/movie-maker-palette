CREATE OR REPLACE FUNCTION public.handle_rental_paid_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF NEW.status <> 'paid'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'paid')
     OR COALESCE(NEW.price, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.reward_vouchers(user_id, source_intent_id, amount, expires_at)
    VALUES (NEW.user_id, NEW.id, 15000, now() + interval '7 days')
    ON CONFLICT (source_intent_id) DO NOTHING;

    SELECT * INTO r
    FROM public.user_referrals
    WHERE referred_id = NEW.user_id
      AND status = 'pending'
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.user_referrals
      SET status = 'qualified',
          qualifying_intent_id = NEW.id,
          qualified_at = now(),
          referrer_reward = 10000,
          referred_reward = 0
      WHERE id = r.id;

      PERFORM public.reward_credit_wallet(
        r.referrer_id,
        10000,
        'referral_reward:referrer:' || r.id,
        'referral_bonus',
        'Referral reward - your friend made their first rental',
        jsonb_build_object('referral_id', r.id, 'withdrawable', false)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'rental reward error: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

UPDATE public.user_referrals
SET referrer_reward = 10000,
    referred_reward = 0
WHERE status = 'qualified'
  AND referrer_reward = 20000
  AND referred_reward = 20000;

REVOKE EXECUTE ON FUNCTION public.handle_rental_paid_rewards() FROM PUBLIC, anon, authenticated;

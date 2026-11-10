CREATE OR REPLACE FUNCTION public.grant_signup_bonus(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_wallet_id uuid;
  v_balance bigint;
  v_reference text := 'signup_bonus:' || p_user_id;
  v_transaction_id uuid;
BEGIN
  SELECT wallet_id, balance INTO v_wallet_id, v_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_wallet_id IS NULL THEN
    v_wallet_id := public.ensure_wallet_for_user(p_user_id);
    v_balance := 0;
  END IF;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, transaction_type, amount, reference, description,
    metadata, balance_before, balance_after, created_at
  ) VALUES (
    v_wallet_id, p_user_id, 'signup_bonus', 40000, v_reference,
    'Signup bonus credit - promotional rental wallet funds',
    jsonb_build_object('source', 'signup_bonus', 'promo_type', 'new_user', 'withdrawable', false),
    v_balance, v_balance + 40000, now()
  ) ON CONFLICT (reference) DO NOTHING
  RETURNING id INTO v_transaction_id;

  IF v_transaction_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.wallets
  SET balance = balance + 40000, updated_at = now()
  WHERE wallet_id = v_wallet_id;

  RETURN v_transaction_id;
END;
$function$;

DROP POLICY IF EXISTS "Own referral code" ON public.user_referral_codes;
CREATE POLICY "Own referral code" ON public.user_referral_codes FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_any_role(auth.uid(), ARRAY['super_admin'::public.app_role, 'admin'::public.app_role, 'sales'::public.app_role, 'accounting'::public.app_role])
);

DROP POLICY IF EXISTS "See own referrals" ON public.user_referrals;
CREATE POLICY "See own referrals" ON public.user_referrals FOR SELECT TO authenticated
USING (
  referrer_id = auth.uid()
  OR referred_id = auth.uid()
  OR public.has_any_role(auth.uid(), ARRAY['super_admin'::public.app_role, 'admin'::public.app_role, 'sales'::public.app_role, 'accounting'::public.app_role])
);

DROP POLICY IF EXISTS "See own vouchers" ON public.reward_vouchers;
CREATE POLICY "See own vouchers" ON public.reward_vouchers FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_any_role(auth.uid(), ARRAY['super_admin'::public.app_role, 'admin'::public.app_role, 'sales'::public.app_role, 'accounting'::public.app_role])
);
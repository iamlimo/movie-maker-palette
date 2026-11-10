CREATE OR REPLACE FUNCTION public.claim_reward_voucher(p_voucher_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v record;
BEGIN
  SELECT * INTO v
  FROM public.reward_vouchers
  WHERE id = p_voucher_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher not found';
  END IF;

  IF v.status <> 'active' THEN
    RAISE EXCEPTION 'Voucher already used';
  END IF;

  IF v.expires_at <= now() THEN
    UPDATE public.reward_vouchers SET status = 'expired' WHERE id = v.id;
    RETURN 0;
  END IF;

  UPDATE public.reward_vouchers SET status = 'claimed', claimed_at = now() WHERE id = v.id;
  PERFORM public.reward_credit_wallet(
    v.user_id,
    v.amount,
    'reward_voucher:' || v.id,
    'reward_voucher',
    'Next-rental reward credit',
    jsonb_build_object('voucher_id', v.id, 'withdrawable', false)
  );
  RETURN v.amount;
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_reward_voucher(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_reward_voucher(uuid) TO authenticated;
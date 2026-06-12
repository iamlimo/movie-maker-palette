-- Fix wallet rentals failing with: column "is_valid" does not exist.
-- The edge function validates referral codes and passes the already-discounted
-- final price, so this RPC should not depend on legacy referral schema fields.

DROP FUNCTION IF EXISTS public.process_wallet_rental_payment(
  uuid,
  uuid,
  text,
  bigint,
  timestamptz,
  jsonb,
  text,
  bigint,
  text
);

DROP FUNCTION IF EXISTS public.process_wallet_rental_payment(
  uuid,
  text,
  text,
  bigint,
  timestamptz,
  jsonb,
  text,
  bigint,
  text
);

DROP FUNCTION IF EXISTS public.process_wallet_rental_payment(
  text,
  text,
  text,
  bigint,
  timestamptz,
  jsonb,
  text,
  bigint,
  text
);

DROP FUNCTION IF EXISTS public.process_wallet_rental_payment(
  uuid,
  uuid,
  text,
  numeric,
  timestamptz,
  jsonb,
  text,
  numeric,
  text
);

DROP FUNCTION IF EXISTS public.process_wallet_rental_payment(
  uuid,
  uuid,
  text,
  bigint,
  timestamp,
  jsonb,
  text,
  bigint,
  text
);

CREATE FUNCTION public.process_wallet_rental_payment(
  p_user_id uuid,
  p_content_id uuid,
  p_content_type text,
  p_final_price bigint,
  p_expires_at timestamptz,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_referral_code text DEFAULT NULL,
  p_discount_amount bigint DEFAULT 0,
  p_provider_reference text DEFAULT NULL
)
RETURNS TABLE (
  rental_intent_id uuid,
  rental_access_id uuid,
  wallet_balance numeric,
  final_price bigint,
  discount_amount bigint,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content_type text := lower(trim(p_content_type));
  v_wallet_id uuid;
  v_wallet_balance numeric;
  v_existing_access_id uuid;
  v_existing_intent_id uuid;
  v_intent_id uuid;
  v_access_id uuid;
  v_now timestamptz := now();
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
BEGIN
  IF v_content_type NOT IN ('movie', 'season', 'episode') THEN
    RAISE EXCEPTION 'Invalid content type: %', p_content_type
      USING ERRCODE = '22023';
  END IF;

  IF p_final_price < 0 THEN
    RAISE EXCEPTION 'Final price cannot be negative'
      USING ERRCODE = '22023';
  END IF;

  SELECT w.wallet_id, COALESCE(w.balance, 0)
    INTO v_wallet_id, v_wallet_balance
  FROM public.wallets w
  WHERE w.user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT ra.id, ra.rental_intent_id
    INTO v_existing_access_id, v_existing_intent_id
  FROM public.rental_access ra
  WHERE ra.user_id = p_user_id
    AND ra.status = 'paid'
    AND ra.revoked_at IS NULL
    AND ra.expires_at > v_now
    AND (
      (v_content_type = 'movie' AND ra.movie_id = p_content_id) OR
      (v_content_type = 'season' AND ra.season_id = p_content_id) OR
      (v_content_type = 'episode' AND ra.episode_id = p_content_id)
    )
  ORDER BY ra.expires_at DESC
  LIMIT 1;

  IF v_existing_access_id IS NOT NULL THEN
    rental_intent_id := v_existing_intent_id;
    rental_access_id := v_existing_access_id;
    wallet_balance := v_wallet_balance;
    final_price := p_final_price;
    discount_amount := COALESCE(p_discount_amount, 0);
    expires_at := p_expires_at;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_wallet_balance < p_final_price THEN
    RAISE EXCEPTION 'Insufficient wallet balance'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.wallets
  SET balance = COALESCE(balance, 0) - p_final_price,
      updated_at = v_now
  WHERE wallet_id = v_wallet_id
  RETURNING balance INTO v_wallet_balance;

  INSERT INTO public.rental_intents (
    user_id,
    movie_id,
    season_id,
    episode_id,
    rental_type,
    price,
    currency,
    payment_method,
    status,
    referral_code,
    discount_amount,
    provider_reference,
    paystack_reference,
    metadata,
    expires_at,
    paid_at
  )
  VALUES (
    p_user_id,
    CASE WHEN v_content_type = 'movie' THEN p_content_id ELSE NULL END,
    CASE WHEN v_content_type = 'season' THEN p_content_id ELSE NULL END,
    CASE WHEN v_content_type = 'episode' THEN p_content_id ELSE NULL END,
    v_content_type,
    p_final_price,
    'NGN',
    'wallet',
    'paid',
    NULLIF(upper(trim(COALESCE(p_referral_code, ''))), ''),
    COALESCE(p_discount_amount, 0),
    p_provider_reference,
    p_provider_reference,
    v_metadata || jsonb_build_object(
      'payment_method', 'wallet',
      'payment_channel', 'wallet',
      'amount_paid', p_final_price
    ),
    p_expires_at,
    v_now
  )
  RETURNING id INTO v_intent_id;

  v_access_id := public.grant_rental_access(
    p_user_id,
    p_content_id,
    v_content_type,
    v_content_type,
    p_expires_at,
    v_intent_id,
    'rental',
    v_metadata || jsonb_build_object(
      'payment_method', 'wallet',
      'payment_channel', 'wallet',
      'amount_paid', p_final_price,
      'rental_intent_id', v_intent_id
    )
  );

  IF v_access_id IS NULL THEN
    RAISE EXCEPTION 'Failed to grant rental access'
      USING ERRCODE = 'P0001';
  END IF;

  rental_intent_id := v_intent_id;
  rental_access_id := v_access_id;
  wallet_balance := v_wallet_balance;
  final_price := p_final_price;
  discount_amount := COALESCE(p_discount_amount, 0);
  expires_at := p_expires_at;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_wallet_rental_payment(
  uuid,
  uuid,
  text,
  bigint,
  timestamptz,
  jsonb,
  text,
  bigint,
  text
) TO authenticated, service_role;

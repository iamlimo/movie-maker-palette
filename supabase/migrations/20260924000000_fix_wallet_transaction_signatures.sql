-- Fix wallet RPC signature mismatch between edge functions and live DB.
-- The app calls public.credit_wallet(...) and public.process_wallet_transaction(...)
-- with a compatible signature that must exist in the target Supabase project.

DROP FUNCTION IF EXISTS public.credit_wallet(
  uuid,
  bigint,
  text,
  text,
  text,
  jsonb,
  uuid,
  uuid
);

DROP FUNCTION IF EXISTS public.process_wallet_transaction(
  uuid,
  numeric,
  text,
  text,
  uuid,
  jsonb
);

DROP FUNCTION IF EXISTS public.process_wallet_transaction(
  uuid,
  bigint,
  text,
  text,
  text,
  jsonb,
  boolean,
  uuid,
  uuid
);

CREATE OR REPLACE FUNCTION public.process_wallet_transaction(
  p_wallet_id uuid,
  p_amount numeric,
  p_type text,
  p_description text DEFAULT NULL,
  p_payment_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_tx_id uuid;
  v_final_amount numeric;
  v_user_id uuid;
  v_balance_before numeric;
  v_balance_after numeric;
  v_reference text;
BEGIN
  v_tx_id := gen_random_uuid();
  v_reference := 'TXN-' || encode(gen_random_bytes(6), 'hex');

  SELECT user_id, balance INTO v_user_id, v_balance_before
  FROM public.wallets
  WHERE wallet_id = p_wallet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found with ID: %', p_wallet_id;
  END IF;

  v_balance_before := COALESCE(v_balance_before, 0);

  IF lower(p_type) IN ('credit', 'wallet_topup') THEN
    v_final_amount := p_amount;
  ELSIF lower(p_type) = 'debit' THEN
    v_final_amount := -p_amount;
  ELSE
    RAISE EXCEPTION 'Invalid transaction type: %', p_type;
  END IF;

  v_balance_after := v_balance_before + v_final_amount;

  UPDATE public.wallets
  SET balance = v_balance_after,
      updated_at = now()
  WHERE wallet_id = p_wallet_id;

  INSERT INTO public.wallet_transactions (
    id,
    wallet_id,
    user_id,
    amount,
    transaction_type,
    reference,
    balance_before,
    balance_after,
    description,
    payment_id,
    metadata,
    created_at
  )
  VALUES (
    v_tx_id,
    p_wallet_id,
    v_user_id,
    p_amount,
    p_type,
    v_reference,
    v_balance_before,
    v_balance_after,
    COALESCE(p_description, 'wallet transaction'),
    p_payment_id,
    COALESCE(p_metadata, '{}'::jsonb),
    now()
  );

  RETURN v_tx_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_wallet_transaction(
  p_wallet_id uuid,
  p_amount bigint,
  p_type text,
  p_reference text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_is_credit boolean DEFAULT true,
  p_user_id uuid DEFAULT NULL,
  p_payment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_tx_id uuid;
  v_final_amount numeric;
  v_target_user_id uuid;
  v_balance_before numeric;
  v_balance_after numeric;
  v_reference text;
BEGIN
  v_tx_id := gen_random_uuid();
  v_reference := COALESCE(p_reference, 'TXN-' || encode(gen_random_bytes(6), 'hex'));

  SELECT user_id, balance INTO v_target_user_id, v_balance_before
  FROM public.wallets
  WHERE wallet_id = p_wallet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found with ID: %', p_wallet_id;
  END IF;

  v_balance_before := COALESCE(v_balance_before, 0);

  IF p_is_credit THEN
    v_final_amount := p_amount::numeric;
  ELSE
    v_final_amount := -(p_amount::numeric);
  END IF;

  v_balance_after := v_balance_before + v_final_amount;

  UPDATE public.wallets
  SET balance = v_balance_after,
      updated_at = now()
  WHERE wallet_id = p_wallet_id;

  INSERT INTO public.wallet_transactions (
    id,
    wallet_id,
    user_id,
    amount,
    transaction_type,
    reference,
    balance_before,
    balance_after,
    description,
    payment_id,
    metadata,
    created_at
  )
  VALUES (
    v_tx_id,
    p_wallet_id,
    COALESCE(p_user_id, v_target_user_id),
    p_amount::numeric,
    p_type,
    v_reference,
    v_balance_before,
    v_balance_after,
    COALESCE(p_description, 'wallet transaction'),
    p_payment_id,
    COALESCE(p_metadata, '{}'::jsonb),
    now()
  );

  RETURN v_tx_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_wallet_id uuid,
  p_amount bigint,
  p_type text,
  p_reference text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_user_id uuid DEFAULT NULL,
  p_payment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN public.process_wallet_transaction(
    p_wallet_id,
    p_amount,
    p_type,
    p_reference,
    p_description,
    p_metadata,
    true,
    p_user_id,
    p_payment_id
  );
END;
$function$;

ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_transaction_type_check;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_transaction_type_check
  CHECK (transaction_type IN ('credit', 'debit', 'rental', 'purchase', 'wallet_topup'));

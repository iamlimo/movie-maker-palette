DROP FUNCTION IF EXISTS public.process_wallet_transaction(uuid, numeric, text, text, text, jsonb, boolean, uuid, uuid);
DROP FUNCTION IF EXISTS public.process_wallet_transaction(uuid, bigint, text, text, text, jsonb, boolean, uuid, uuid);

ALTER FUNCTION public.process_wallet_transaction(uuid, numeric, text, text, uuid, jsonb) SET search_path = public;

GRANT EXECUTE ON FUNCTION public.process_wallet_transaction(uuid, numeric, text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_wallet_transaction(uuid, numeric, text, text, uuid, jsonb) TO service_role;
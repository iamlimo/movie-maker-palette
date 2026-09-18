-- Auto-credit wallets when a payments row transitions to completed for wallet_topup
-- This trigger is idempotent: it only runs on status change to 'completed'
-- and relies on existing RPCs `ensure_wallet_for_user` and `credit_wallet`.

CREATE OR REPLACE FUNCTION public.trigger_credit_wallet_on_payment_completed()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_wallet_id text;
  v_amount bigint;
BEGIN
  -- Only act for wallet top-ups and when enhanced_status becomes 'completed'
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.enhanced_status = 'completed' AND (OLD.enhanced_status IS DISTINCT FROM NEW.enhanced_status)
       AND NEW.purpose = 'wallet_topup' THEN

      -- Amount is stored in payments.amount (assumed integer kobo)
      v_amount := COALESCE(NEW.amount, 0);

      -- Ensure user has a wallet
      PERFORM public.ensure_wallet_for_user(NEW.user_id);

      -- Lookup wallet id
      SELECT wallet_id INTO v_wallet_id FROM wallets WHERE user_id = NEW.user_id LIMIT 1;

      IF v_wallet_id IS NULL THEN
        RAISE WARNING 'trigger_credit_wallet: wallet not found for user %', NEW.user_id;
        RETURN NEW;
      END IF;

      -- Call credit_wallet RPC. The RPC is expected to be idempotent and handle duplicate credits.
      PERFORM public.credit_wallet(
        p_wallet_id => v_wallet_id,
        p_amount => v_amount,
        p_type => 'wallet_topup',
        p_reference => COALESCE(NEW.provider_reference, NEW.intent_id, NEW.id::text),
        p_description => 'wallet credited with paystack',
        p_metadata => json_build_object('source', 'payment_trigger')::json,
        p_user_id => NEW.user_id,
        p_payment_id => NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger on payments table
DROP TRIGGER IF EXISTS payments_auto_credit_wallet ON public.payments;
CREATE TRIGGER payments_auto_credit_wallet
AFTER UPDATE ON public.payments
FOR EACH ROW
WHEN (OLD.enhanced_status IS DISTINCT FROM NEW.enhanced_status)
EXECUTE FUNCTION public.trigger_credit_wallet_on_payment_completed();

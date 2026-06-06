
CREATE OR REPLACE FUNCTION public.handle_season_paid_revoke_episodes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid' OR NEW.rental_type <> 'season' OR NEW.season_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;

  UPDATE public.rental_access
    SET revoked_at = now(),
        status = 'failed',
        updated_at = now()
  WHERE user_id = NEW.user_id
    AND revoked_at IS NULL
    AND episode_id IN (SELECT id FROM public.episodes WHERE season_id = NEW.season_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rental_intents_season_revoke ON public.rental_intents;
CREATE TRIGGER rental_intents_season_revoke
  AFTER INSERT OR UPDATE OF status ON public.rental_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_season_paid_revoke_episodes();

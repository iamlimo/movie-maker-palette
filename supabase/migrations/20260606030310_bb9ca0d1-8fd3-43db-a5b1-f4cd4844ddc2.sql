
-- 1. Table
CREATE TABLE IF NOT EXISTS public.rental_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  season_id uuid NOT NULL,
  episode_id uuid NOT NULL,
  rental_intent_id uuid NOT NULL UNIQUE,
  amount_paid bigint NOT NULL DEFAULT 0,
  rental_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rental_credits_user_season_date_idx
  ON public.rental_credits (user_id, season_id, rental_date DESC);

GRANT SELECT ON public.rental_credits TO authenticated;
GRANT ALL ON public.rental_credits TO service_role;

ALTER TABLE public.rental_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rental_credits_select_own" ON public.rental_credits;
CREATE POLICY "rental_credits_select_own"
  ON public.rental_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- 2. Trigger function: records credit on paid episode intent + auto-unlock
CREATE OR REPLACE FUNCTION public.handle_episode_rental_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
  v_spent bigint;
  v_has_season boolean;
  v_expiry_hours int := 336;
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid' OR NEW.rental_type <> 'episode' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;

  SELECT season_id INTO v_season_id FROM public.episodes WHERE id = NEW.episode_id;
  IF v_season_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.rental_credits (user_id, season_id, episode_id, rental_intent_id, amount_paid, rental_date)
  VALUES (NEW.user_id, v_season_id, NEW.episode_id, NEW.id, COALESCE(NEW.price, 0), COALESCE(NEW.paid_at, now()))
  ON CONFLICT (rental_intent_id) DO NOTHING;

  SELECT COALESCE(SUM(amount_paid), 0) INTO v_spent
  FROM public.rental_credits
  WHERE user_id = NEW.user_id
    AND season_id = v_season_id
    AND rental_date >= now() - INTERVAL '7 days';

  IF v_spent >= 120000 THEN
    SELECT EXISTS(
      SELECT 1 FROM public.rental_access
      WHERE user_id = NEW.user_id
        AND season_id = v_season_id
        AND revoked_at IS NULL
        AND status = 'paid'
        AND expires_at > now()
    ) INTO v_has_season;

    IF NOT v_has_season THEN
      SELECT COALESCE(rental_expiry_duration, 336) INTO v_expiry_hours
      FROM public.seasons WHERE id = v_season_id;

      PERFORM public.grant_rental_access(
        NEW.user_id,
        v_season_id,
        'season',
        'season',
        now() + (v_expiry_hours || ' hours')::interval,
        NULL,
        'auto_unlock',
        jsonb_build_object('source','auto_unlock','eligible_spend', v_spent)
      );

      UPDATE public.rental_access
        SET revoked_at = now(),
            status = 'failed',
            updated_at = now()
      WHERE user_id = NEW.user_id
        AND revoked_at IS NULL
        AND episode_id IN (SELECT id FROM public.episodes WHERE season_id = v_season_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rental_intents_episode_credit ON public.rental_intents;
CREATE TRIGGER rental_intents_episode_credit
  AFTER INSERT OR UPDATE OF status ON public.rental_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_episode_rental_credit();

-- 3. RPC for frontend quote
CREATE OR REPLACE FUNCTION public.calculate_season_upgrade_price(
  p_user_id uuid,
  p_season_id uuid
)
RETURNS TABLE (
  eligible_spend bigint,
  upgrade_price bigint,
  full_price bigint,
  qualifies boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spent bigint;
  v_full bigint;
  v_has_active boolean;
BEGIN
  SELECT COALESCE(SUM(amount_paid), 0) INTO v_spent
  FROM public.rental_credits
  WHERE user_id = p_user_id
    AND season_id = p_season_id
    AND rental_date >= now() - INTERVAL '7 days';

  SELECT COALESCE(price::bigint, 120000) INTO v_full
  FROM public.seasons WHERE id = p_season_id;

  SELECT EXISTS(
    SELECT 1 FROM public.rental_access
    WHERE user_id = p_user_id
      AND season_id = p_season_id
      AND revoked_at IS NULL
      AND status = 'paid'
      AND expires_at > now()
  ) INTO v_has_active;

  eligible_spend := v_spent;
  full_price := v_full;
  upgrade_price := GREATEST(120000 - v_spent, 0);
  qualifies := v_spent > 0 AND NOT v_has_active;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_season_upgrade_price(uuid, uuid) TO authenticated, service_role;

-- 4. Backfill
INSERT INTO public.rental_credits (user_id, season_id, episode_id, rental_intent_id, amount_paid, rental_date)
SELECT ri.user_id, e.season_id, ri.episode_id, ri.id, COALESCE(ri.price, 0), COALESCE(ri.paid_at, ri.created_at)
FROM public.rental_intents ri
JOIN public.episodes e ON e.id = ri.episode_id
WHERE ri.status = 'paid'
  AND ri.rental_type = 'episode'
  AND ri.episode_id IS NOT NULL
ON CONFLICT (rental_intent_id) DO NOTHING;

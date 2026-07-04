-- Idempotency guard: prevent duplicate active rental_access rows for the same rental_intent.
-- Retry Verification (and concurrent webhook + client verify) can race; without this index
-- grant_rental_access ON CONFLICT DO NOTHING has nothing to conflict on and could insert dupes.
CREATE UNIQUE INDEX IF NOT EXISTS rental_access_intent_active_unique
  ON public.rental_access (rental_intent_id)
  WHERE revoked_at IS NULL AND rental_intent_id IS NOT NULL;

-- Also prevent duplicate active grants per (user, content) when there is no intent id.
CREATE UNIQUE INDEX IF NOT EXISTS rental_access_movie_active_unique
  ON public.rental_access (user_id, movie_id)
  WHERE revoked_at IS NULL AND movie_id IS NOT NULL AND status = 'paid';

CREATE UNIQUE INDEX IF NOT EXISTS rental_access_season_active_unique
  ON public.rental_access (user_id, season_id)
  WHERE revoked_at IS NULL AND season_id IS NOT NULL AND status = 'paid';

CREATE UNIQUE INDEX IF NOT EXISTS rental_access_episode_active_unique
  ON public.rental_access (user_id, episode_id)
  WHERE revoked_at IS NULL AND episode_id IS NOT NULL AND status = 'paid';
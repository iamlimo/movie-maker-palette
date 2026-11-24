-- Make watch-history updates automatically maintain watch-hour totals.
-- This fixes users whose player saves position directly without the RPC autosave hook.

CREATE OR REPLACE FUNCTION public.sync_watch_hours_from_watch_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_position_minutes bigint;
  v_content_key text;
  v_session_id text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_position_minutes := FLOOR(GREATEST(0, COALESCE(NEW.playback_position, 0)) / 60)::bigint;
  IF v_position_minutes <= 0 THEN
    PERFORM public.sync_user_watch_hour_totals(NEW.user_id);
    RETURN NEW;
  END IF;

  v_content_key := NEW.content_id;
  v_session_id := 'watch-hours-' || NEW.user_id::text || '-' || lower(COALESCE(NEW.content_type, 'movie')) || '-' || v_content_key;

  INSERT INTO public.watch_hour_sessions (
    user_id,
    session_id,
    content_type,
    movie_id,
    episode_id,
    eligible_minutes,
    elapsed_seconds,
    started_at,
    ended_at,
    status,
    updated_at
  )
  VALUES (
    NEW.user_id,
    v_session_id,
    CASE WHEN lower(COALESCE(NEW.content_type, 'movie')) = 'episode' THEN 'episode' ELSE 'movie' END,
    CASE WHEN lower(COALESCE(NEW.content_type, 'movie')) <> 'episode'
      AND v_content_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN v_content_key::uuid ELSE NULL END,
    CASE WHEN lower(COALESCE(NEW.content_type, 'movie')) = 'episode'
      AND v_content_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN v_content_key::uuid ELSE NULL END,
    v_position_minutes,
    GREATEST(0, COALESCE(NEW.playback_position, 0)),
    COALESCE(NEW.created_at, NEW.last_watched_at, now()),
    COALESCE(NEW.last_watched_at, NEW.updated_at, now()),
    'recorded',
    COALESCE(NEW.last_watched_at, NEW.updated_at, now())
  )
  ON CONFLICT (session_id) DO UPDATE SET
    eligible_minutes = GREATEST(public.watch_hour_sessions.eligible_minutes, EXCLUDED.eligible_minutes),
    elapsed_seconds = GREATEST(public.watch_hour_sessions.elapsed_seconds, EXCLUDED.elapsed_seconds),
    ended_at = GREATEST(COALESCE(public.watch_hour_sessions.ended_at, EXCLUDED.ended_at), EXCLUDED.ended_at),
    updated_at = GREATEST(public.watch_hour_sessions.updated_at, EXCLUDED.updated_at);

  PERFORM public.sync_user_watch_hour_totals(NEW.user_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_watch_hours_from_watch_history ON public.watch_history;
CREATE TRIGGER trg_sync_watch_hours_from_watch_history
AFTER INSERT OR UPDATE OF playback_position, last_watched_at, completed
ON public.watch_history
FOR EACH ROW
EXECUTE FUNCTION public.sync_watch_hours_from_watch_history();

CREATE OR REPLACE FUNCTION public.backfill_watch_hours_from_history(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH valid_history AS (
    SELECT
      w.*,
      CASE
        WHEN w.content_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN w.content_id::text::uuid
        ELSE NULL
      END AS content_uuid
    FROM public.watch_history w
    WHERE w.user_id::text = p_user_id::text
  )
  INSERT INTO public.watch_hour_sessions (
    user_id, session_id, content_type, movie_id, episode_id,
    eligible_minutes, elapsed_seconds, started_at, ended_at, status, updated_at
  )
  SELECT
    p_user_id,
    'watch-hours-' || p_user_id::text || '-' || lower(w.content_type) || '-' || w.content_id::text,
    CASE WHEN lower(w.content_type) = 'episode' THEN 'episode' ELSE 'movie' END,
    CASE WHEN lower(w.content_type) <> 'episode' THEN w.content_uuid ELSE NULL END,
    CASE WHEN lower(w.content_type) = 'episode' THEN w.content_uuid ELSE NULL END,
    FLOOR(COALESCE(w.playback_position, 0) / 60)::bigint,
    COALESCE(w.playback_position, 0)::bigint,
    COALESCE(w.created_at, w.last_watched_at, now()),
    COALESCE(w.last_watched_at, w.updated_at, now()),
    'recorded',
    COALESCE(w.last_watched_at, w.updated_at, now())
  FROM valid_history w
  WHERE w.content_id IS NOT NULL
  ON CONFLICT (session_id) DO UPDATE SET
    eligible_minutes = GREATEST(public.watch_hour_sessions.eligible_minutes, EXCLUDED.eligible_minutes),
    elapsed_seconds = GREATEST(public.watch_hour_sessions.elapsed_seconds, EXCLUDED.elapsed_seconds),
    ended_at = GREATEST(COALESCE(public.watch_hour_sessions.ended_at, EXCLUDED.ended_at), EXCLUDED.ended_at),
    updated_at = GREATEST(public.watch_hour_sessions.updated_at, EXCLUDED.updated_at);

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  PERFORM public.sync_user_watch_hour_totals(p_user_id);
  RETURN v_inserted;
END $$;

-- Backfill every existing watch-history row now.
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  FOR v_user_id IN
    SELECT DISTINCT user_id
    FROM public.profiles
    WHERE user_id IS NOT NULL
  LOOP
    PERFORM public.backfill_watch_hours_from_history(v_user_id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.sync_all_user_watch_hour_totals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_count integer := 0;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised staff can synchronise all watch-hour totals';
  END IF;

  FOR v_user_id IN
    SELECT DISTINCT user_id
    FROM public.profiles
    WHERE user_id IS NOT NULL
  LOOP
    PERFORM public.backfill_watch_hours_from_history(v_user_id);
    PERFORM public.sync_user_watch_hour_totals(v_user_id);
    v_count := v_count + 1;
  END LOOP;

  FOR v_user_id IN
    SELECT DISTINCT user_id
    FROM public.watch_hour_sessions
    WHERE user_id IS NOT NULL
  LOOP
    PERFORM public.sync_user_watch_hour_totals(v_user_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.sync_watch_hours_from_watch_history() TO authenticated;

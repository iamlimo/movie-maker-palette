-- Fix watch-hour tracking so each piece of content has one cumulative session,
-- old duplicate session rows cannot inflate totals, and existing watch_history
-- data is backfilled for users who never invoked the RPC.

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
        WHEN w.content_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN w.content_id::uuid
        ELSE NULL
      END AS content_uuid
    FROM public.watch_history w
    WHERE w.user_id::text = p_user_id::text
  )
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
  SELECT
    p_user_id,
    'watch-hours-' || p_user_id::text || '-' || lower(w.content_type) || '-' || w.content_id,
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

CREATE OR REPLACE FUNCTION public.record_watch_hour_session(
  p_user_id uuid,
  p_session_id text,
  p_content_type text,
  p_eligible_minutes bigint,
  p_elapsed_seconds bigint,
  p_movie_id uuid DEFAULT NULL,
  p_movie_title text DEFAULT NULL,
  p_tv_show_id uuid DEFAULT NULL,
  p_tv_show_title text DEFAULT NULL,
  p_season_id uuid DEFAULT NULL,
  p_season_number integer DEFAULT NULL,
  p_episode_id uuid DEFAULT NULL,
  p_episode_number integer DEFAULT NULL,
  p_rental_reference text DEFAULT NULL,
  p_entitlement_type text DEFAULT 'episode'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_content_id text;
  v_session_id text;
BEGIN
  IF p_user_id IS NULL OR auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot record watch hours for another user';
  END IF;

  v_content_id := COALESCE(p_episode_id::text, p_movie_id::text, p_session_id);
  v_session_id := 'watch-hours-' || p_user_id::text || '-' || lower(p_content_type) || '-' || v_content_id;

  INSERT INTO public.watch_hour_sessions (
    user_id, session_id, content_type, eligible_minutes, elapsed_seconds,
    movie_id, movie_title, tv_show_id, tv_show_title, season_id, season_number,
    episode_id, episode_number, rental_reference, entitlement_type,
    started_at, ended_at, status, updated_at
  )
  VALUES (
    p_user_id, v_session_id, lower(p_content_type), GREATEST(0, p_eligible_minutes),
    GREATEST(0, p_elapsed_seconds), p_movie_id, p_movie_title, p_tv_show_id,
    p_tv_show_title, p_season_id, p_season_number, p_episode_id, p_episode_number,
    p_rental_reference, COALESCE(p_entitlement_type, 'episode'), now(), now(), 'recorded', now()
  )
  ON CONFLICT (session_id) DO UPDATE SET
    eligible_minutes = GREATEST(public.watch_hour_sessions.eligible_minutes, EXCLUDED.eligible_minutes),
    elapsed_seconds = GREATEST(public.watch_hour_sessions.elapsed_seconds, EXCLUDED.elapsed_seconds),
    ended_at = now(),
    updated_at = now()
  RETURNING id INTO v_id;

  PERFORM public.sync_user_watch_hour_totals(p_user_id);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.sync_user_watch_hour_totals(p_user_id uuid)
RETURNS public.user_watch_hour_totals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_config record;
  v_total_minutes bigint := 0;
  v_credited_minutes bigint := 0;
  v_block_minutes bigint := 120;
  v_reward_amount_kobo bigint := 10000;
  v_pending_blocks bigint := 0;
  v_pending_minutes bigint := 0;
  v_remaining_minutes bigint := 0;
  v_last_watched timestamptz;
  v_session_last timestamptz;
  v_history_last timestamptz;
  v_row public.user_watch_hour_totals;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_config FROM public.watch_hour_config ORDER BY created_at DESC LIMIT 1;
  IF v_config IS NULL THEN
    v_block_minutes := 120;
    v_reward_amount_kobo := 10000;
  ELSE
    v_block_minutes := GREATEST(1, COALESCE(v_config.reward_minutes, 120));
    v_reward_amount_kobo := GREATEST(0, COALESCE(v_config.reward_amount_kobo, 10000));
  END IF;

  -- One row per content: this prevents the old timestamp-based session IDs
  -- and repeated resume updates from cumulatively inflating watch time.
  WITH grouped AS (
    SELECT
      COALESCE(s.movie_id::text, s.episode_id::text, s.session_id) AS content_key,
      MAX(s.eligible_minutes) AS eligible_minutes
    FROM public.watch_hour_sessions s
    WHERE s.user_id::text = p_user_id::text
      AND s.status IN ('recorded', 'credited')
    GROUP BY COALESCE(s.movie_id::text, s.episode_id::text, s.session_id)
  )
  SELECT COALESCE(SUM(eligible_minutes), 0)
  INTO v_total_minutes
  FROM grouped;

  SELECT COALESCE(SUM(credited_minutes), 0)
  INTO v_credited_minutes
  FROM public.watch_hour_reward_credits
  WHERE user_id::text = p_user_id::text;

  SELECT MAX(updated_at) INTO v_session_last
  FROM public.watch_hour_sessions
  WHERE user_id::text = p_user_id::text;

  SELECT MAX(last_watched_at) INTO v_history_last
  FROM public.watch_history
  WHERE user_id::text = p_user_id::text;

  v_last_watched := GREATEST(COALESCE(v_session_last, '-infinity'::timestamptz), COALESCE(v_history_last, '-infinity'::timestamptz));
  IF v_last_watched = '-infinity'::timestamptz THEN v_last_watched := NULL; END IF;

  v_pending_blocks := FLOOR(GREATEST(0, v_total_minutes - v_credited_minutes) / v_block_minutes);
  v_pending_minutes := v_pending_blocks * v_block_minutes;
  v_remaining_minutes := GREATEST(0, v_total_minutes - v_credited_minutes - v_pending_minutes);

  INSERT INTO public.user_watch_hour_totals (
    user_id, total_eligible_minutes, credited_reward_minutes,
    pending_reward_minutes, pending_reward_value_kobo, credited_reward_value_kobo,
    completed_reward_blocks, remaining_minutes, last_watched_at, status, updated_at
  )
  VALUES (
    p_user_id, v_total_minutes, v_credited_minutes, v_pending_minutes,
    v_pending_blocks * v_reward_amount_kobo,
    COALESCE((SELECT SUM(reward_amount_kobo) FROM public.watch_hour_reward_credits WHERE user_id::text = p_user_id::text), 0),
    v_pending_blocks, v_remaining_minutes, v_last_watched,
    CASE WHEN v_pending_blocks > 0 THEN 'pending_review' ELSE 'in_progress' END, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_eligible_minutes = EXCLUDED.total_eligible_minutes,
    credited_reward_minutes = EXCLUDED.credited_reward_minutes,
    pending_reward_minutes = EXCLUDED.pending_reward_minutes,
    pending_reward_value_kobo = EXCLUDED.pending_reward_value_kobo,
    credited_reward_value_kobo = EXCLUDED.credited_reward_value_kobo,
    completed_reward_blocks = EXCLUDED.completed_reward_blocks,
    remaining_minutes = EXCLUDED.remaining_minutes,
    last_watched_at = EXCLUDED.last_watched_at,
    status = EXCLUDED.status,
    updated_at = now();

  SELECT * INTO v_row FROM public.user_watch_hour_totals WHERE user_id = p_user_id;
  RETURN v_row;
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
    SELECT DISTINCT user_id::uuid
    FROM public.watch_history
    WHERE user_id IS NOT NULL
      AND user_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  LOOP
    PERFORM public.backfill_watch_hours_from_history(v_user_id);
  END LOOP;

  FOR v_user_id IN
    SELECT user_id::uuid FROM public.profiles WHERE user_id IS NOT NULL
  LOOP
    PERFORM public.sync_user_watch_hour_totals(v_user_id);
    v_count := v_count + 1;
  END LOOP;

  FOR v_user_id IN
    SELECT DISTINCT user_id::uuid FROM public.watch_hour_sessions WHERE user_id IS NOT NULL
  LOOP
    PERFORM public.sync_user_watch_hour_totals(v_user_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.backfill_watch_hours_from_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_watch_hour_session(uuid, text, text, bigint, bigint, uuid, text, uuid, text, uuid, integer, uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_user_watch_hour_totals() TO authenticated;

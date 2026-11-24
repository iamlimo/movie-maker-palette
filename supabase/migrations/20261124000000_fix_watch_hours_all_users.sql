-- Backfill and consistently aggregate watch-hour totals for every user.
-- This migration also prevents cumulative playback from being counted multiple times
-- when the player reports the same content repeatedly.

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
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot record watch hours for another user';
  END IF;

  INSERT INTO public.watch_hour_sessions (
    user_id,
    session_id,
    content_type,
    eligible_minutes,
    elapsed_seconds,
    movie_id,
    movie_title,
    tv_show_id,
    tv_show_title,
    season_id,
    season_number,
    episode_id,
    episode_number,
    rental_reference,
    entitlement_type,
    started_at,
    ended_at,
    status,
    updated_at
  )
  VALUES (
    p_user_id,
    p_session_id,
    p_content_type,
    GREATEST(0, p_eligible_minutes),
    GREATEST(0, p_elapsed_seconds),
    p_movie_id,
    p_movie_title,
    p_tv_show_id,
    p_tv_show_title,
    p_season_id,
    p_season_number,
    p_episode_id,
    p_episode_number,
    p_rental_reference,
    COALESCE(p_entitlement_type, 'episode'),
    now(),
    now(),
    'recorded',
    now()
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
    v_block_minutes := COALESCE(v_config.reward_minutes, 120);
    v_reward_amount_kobo := COALESCE(v_config.reward_amount_kobo, 10000);
  END IF;

  -- Combine session records and watch-history rows by content, using the greatest
  -- value for that content. This avoids double-counting the same resumed video.
  WITH session_totals AS (
    SELECT COALESCE(SUM(s.eligible_minutes), 0) AS eligible_minutes
    FROM public.watch_hour_sessions s
    WHERE s.user_id::text = p_user_id::text
      AND s.status IN ('recorded', 'credited')
  )
  SELECT eligible_minutes INTO v_total_minutes
  FROM session_totals;

  SELECT COALESCE(MAX(updated_at), NULL) INTO v_last_watched
  FROM public.watch_hour_sessions
  WHERE user_id::text = p_user_id::text;

  SELECT COALESCE(SUM(credited_minutes), 0) INTO v_credited_minutes
  FROM public.watch_hour_reward_credits
  WHERE user_id::text = p_user_id::text;

  v_pending_blocks := FLOOR(GREATEST(0, v_total_minutes - v_credited_minutes) / v_block_minutes);
  v_pending_minutes := v_pending_blocks * v_block_minutes;
  v_remaining_minutes := GREATEST(0, (v_total_minutes - v_credited_minutes) - v_pending_minutes);

  INSERT INTO public.user_watch_hour_totals (
    user_id,
    total_eligible_minutes,
    credited_reward_minutes,
    pending_reward_minutes,
    pending_reward_value_kobo,
    credited_reward_value_kobo,
    completed_reward_blocks,
    remaining_minutes,
    last_watched_at,
    status,
    updated_at
  )
  VALUES (
    p_user_id,
    v_total_minutes,
    v_credited_minutes,
    v_pending_minutes,
    v_pending_blocks * v_reward_amount_kobo,
    COALESCE((SELECT SUM(reward_amount_kobo) FROM public.watch_hour_reward_credits WHERE user_id = p_user_id), 0),
    v_pending_blocks,
    v_remaining_minutes,
    v_last_watched,
    CASE WHEN v_pending_blocks > 0 THEN 'pending_review' ELSE 'in_progress' END,
    now()
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

  SELECT * INTO v_row
  FROM public.user_watch_hour_totals
  WHERE user_id = p_user_id;

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
    SELECT user_id::uuid
    FROM public.profiles
    WHERE user_id IS NOT NULL
  LOOP
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

CREATE OR REPLACE FUNCTION public.credit_user_watch_hours(
  p_user_id uuid,
  p_admin_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_config record;
  v_total_minutes bigint := 0;
  v_credited_minutes bigint := 0;
  v_blocks bigint := 0;
  v_pending_minutes bigint := 0;
  v_reward_amount_kobo bigint := 0;
  v_reference text;
  v_credited_record uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised staff can credit watch-hour rewards';
  END IF;

  SELECT * INTO v_config FROM public.watch_hour_config ORDER BY created_at DESC LIMIT 1;
  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Watch hours reward config is missing';
  END IF;

  PERFORM public.sync_user_watch_hour_totals(p_user_id);
  SELECT total_eligible_minutes, credited_reward_minutes INTO v_total_minutes, v_credited_minutes
  FROM public.user_watch_hour_totals
  WHERE user_id = p_user_id FOR UPDATE;

  v_blocks := FLOOR(GREATEST(0, v_total_minutes - v_credited_minutes) / v_config.reward_minutes);
  IF v_blocks <= 0 THEN
    RETURN jsonb_build_object(
      'credited_minutes', 0,
      'reward_blocks', 0,
      'reward_amount_kobo', 0,
      'remaining_minutes', GREATEST(0, v_total_minutes - v_credited_minutes)
    );
  END IF;

  v_pending_minutes := v_blocks * v_config.reward_minutes;
  v_reward_amount_kobo := v_blocks * v_config.reward_amount_kobo;
  v_reference := COALESCE(p_reference, 'WATCH_HOURS_REWARD:' || p_user_id::text || ':' || gen_random_uuid()::text);

  INSERT INTO public.watch_hour_reward_credits (
    user_id,
    reward_amount_kobo,
    reward_minutes,
    credited_minutes,
    remaining_minutes,
    status,
    reference,
    admin_id,
    metadata
  )
  VALUES (
    p_user_id,
    v_reward_amount_kobo,
    v_config.reward_minutes,
    v_pending_minutes,
    GREATEST(0, (v_total_minutes - v_credited_minutes) - v_pending_minutes),
    'credited',
    v_reference,
    COALESCE(p_admin_id, auth.uid()),
    jsonb_build_object(
      'source', 'WATCH_HOURS_REWARD',
      'reward_blocks', v_blocks,
      'eligible_minutes', v_total_minutes,
      'credited_minutes', v_credited_minutes,
      'withdrawable', false
    )
  )
  RETURNING id INTO v_credited_record;

  PERFORM public.reward_credit_wallet(
    p_user_id,
    v_reward_amount_kobo,
    v_reference,
    'WATCH_HOURS_REWARD',
    'Manual watch-hours reward credit',
    jsonb_build_object(
      'source', 'WATCH_HOURS_REWARD',
      'reward_blocks', v_blocks,
      'reward_minutes', v_pending_minutes,
      'admin_id', auth.uid(),
      'withdrawable', false
    )
  );

  UPDATE public.watch_hour_sessions
  SET status = 'credited', reward_reference = v_reference, updated_at = now()
  WHERE user_id = p_user_id AND status = 'recorded';

  PERFORM public.sync_user_watch_hour_totals(p_user_id);

  RETURN jsonb_build_object(
    'credited_minutes', v_pending_minutes,
    'reward_blocks', v_blocks,
    'reward_amount_kobo', v_reward_amount_kobo,
    'remaining_minutes', GREATEST(0, (v_total_minutes - v_credited_minutes) - v_pending_minutes),
    'reference', v_reference,
    'credit_id', v_credited_record::text
  );
END $$;

GRANT EXECUTE ON FUNCTION public.record_watch_hour_session(uuid, text, text, bigint, bigint, uuid, text, uuid, text, uuid, integer, uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_user_watch_hour_totals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_user_watch_hours(uuid, uuid, text) TO authenticated;

-- Populate totals immediately for all existing users.
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  FOR v_user_id IN
    SELECT user_id::uuid
    FROM public.profiles
    WHERE user_id IS NOT NULL
  LOOP
    PERFORM public.sync_user_watch_hour_totals(v_user_id);
  END LOOP;

  FOR v_user_id IN
    SELECT DISTINCT user_id::uuid
    FROM public.watch_hour_sessions
    WHERE user_id IS NOT NULL
  LOOP
    PERFORM public.sync_user_watch_hour_totals(v_user_id);
  END LOOP;
END $$;

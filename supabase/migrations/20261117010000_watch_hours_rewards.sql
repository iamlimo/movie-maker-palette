CREATE TABLE IF NOT EXISTS public.watch_hour_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_amount_kobo bigint NOT NULL DEFAULT 10000,
  reward_minutes bigint NOT NULL DEFAULT 120,
  program_status text NOT NULL DEFAULT 'active',
  daily_watch_minutes_limit bigint DEFAULT NULL,
  daily_reward_limit bigint DEFAULT NULL,
  monthly_reward_budget bigint DEFAULT NULL,
  eligible_content text[] NOT NULL DEFAULT ARRAY['movie','episode'],
  eligible_access_methods text[] NOT NULL DEFAULT ARRAY['individual_episode','full_season'],
  content_exclusions text[] NOT NULL DEFAULT ARRAY[]::text[],
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.watch_hour_config (
  reward_amount_kobo,
  reward_minutes,
  program_status,
  daily_watch_minutes_limit,
  daily_reward_limit,
  monthly_reward_budget,
  eligible_content,
  eligible_access_methods,
  content_exclusions,
  notes
)
SELECT
  10000,
  120,
  'active',
  NULL,
  NULL,
  NULL,
  ARRAY['movie','episode'],
  ARRAY['individual_episode','full_season'],
  ARRAY[]::text[],
  '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.watch_hour_config)
ON CONFLICT DO NOTHING;

ALTER TABLE public.watch_hour_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can read config" ON public.watch_hour_config;
CREATE POLICY "Staff can read config" ON public.watch_hour_config
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.watch_hour_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text NOT NULL UNIQUE,
  content_type text NOT NULL CHECK (content_type IN ('movie', 'episode')),
  movie_id uuid,
  movie_title text,
  tv_show_id uuid,
  tv_show_title text,
  season_id uuid,
  season_number integer,
  episode_id uuid,
  episode_number integer,
  rental_reference text,
  entitlement_type text NOT NULL DEFAULT 'episode',
  eligible_minutes bigint NOT NULL DEFAULT 0,
  elapsed_seconds bigint NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'recorded',
  reward_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.watch_hour_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see own watch sessions" ON public.watch_hour_sessions;
CREATE POLICY "Users can see own watch sessions" ON public.watch_hour_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Users can insert own watch sessions" ON public.watch_hour_sessions;
CREATE POLICY "Users can insert own watch sessions" ON public.watch_hour_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own watch sessions" ON public.watch_hour_sessions;
CREATE POLICY "Users can update own watch sessions" ON public.watch_hour_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.watch_hour_reward_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reward_amount_kobo bigint NOT NULL DEFAULT 0,
  reward_minutes bigint NOT NULL DEFAULT 120,
  credited_minutes bigint NOT NULL DEFAULT 0,
  remaining_minutes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'credited',
  reference text NOT NULL UNIQUE,
  admin_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.watch_hour_reward_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see own watch-hour credits" ON public.watch_hour_reward_credits;
CREATE POLICY "Users can see own watch-hour credits" ON public.watch_hour_reward_credits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.user_watch_hour_totals (
  user_id uuid PRIMARY KEY,
  total_eligible_minutes bigint NOT NULL DEFAULT 0,
  credited_reward_minutes bigint NOT NULL DEFAULT 0,
  pending_reward_minutes bigint NOT NULL DEFAULT 0,
  pending_reward_value_kobo bigint NOT NULL DEFAULT 0,
  credited_reward_value_kobo bigint NOT NULL DEFAULT 0,
  completed_reward_blocks bigint NOT NULL DEFAULT 0,
  remaining_minutes bigint NOT NULL DEFAULT 0,
  last_watched_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_watch_hour_totals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see own watch-hour summary" ON public.user_watch_hour_totals;
CREATE POLICY "Users can see own watch-hour summary" ON public.user_watch_hour_totals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

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
  SELECT * INTO v_config FROM public.watch_hour_config ORDER BY created_at DESC LIMIT 1;
  IF v_config IS NULL THEN
    v_block_minutes := 120;
    v_reward_amount_kobo := 10000;
  ELSE
    v_block_minutes := COALESCE(v_config.reward_minutes, 120);
    v_reward_amount_kobo := COALESCE(v_config.reward_amount_kobo, 10000);
  END IF;

  SELECT COALESCE(SUM(eligible_minutes), 0), MAX(ended_at) INTO v_total_minutes, v_last_watched
  FROM public.watch_hour_sessions
  WHERE user_id = p_user_id AND status IN ('recorded', 'credited');

  SELECT COALESCE(SUM(credited_minutes), 0) INTO v_credited_minutes
  FROM public.watch_hour_reward_credits
  WHERE user_id = p_user_id;

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
  v_row public.user_watch_hour_totals;
BEGIN
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
      'admin_id', COALESCE(p_admin_id, auth.uid()),
      'withdrawable', false
    )
  );

  UPDATE public.watch_hour_sessions
  SET status = 'credited',
      reward_reference = v_reference,
      updated_at = now()
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
    eligible_minutes = EXCLUDED.eligible_minutes,
    elapsed_seconds = EXCLUDED.elapsed_seconds,
    updated_at = now()
  RETURNING id INTO v_id;

  PERFORM public.sync_user_watch_hour_totals(p_user_id);
  RETURN v_id;
END $$;

GRANT SELECT ON public.watch_hour_config TO authenticated;
GRANT ALL ON public.watch_hour_config TO service_role;
GRANT SELECT ON public.watch_hour_sessions TO authenticated;
GRANT INSERT, UPDATE ON public.watch_hour_sessions TO authenticated;
GRANT ALL ON public.watch_hour_sessions TO service_role;
GRANT SELECT ON public.watch_hour_reward_credits TO authenticated;
GRANT ALL ON public.watch_hour_reward_credits TO service_role;
GRANT SELECT ON public.user_watch_hour_totals TO authenticated;
GRANT ALL ON public.user_watch_hour_totals TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_user_watch_hour_totals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_user_watch_hours(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_watch_hour_session(uuid, text, text, bigint, bigint, uuid, text, uuid, text, uuid, integer, uuid, integer, text, text) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_watch_hour_sessions_user ON public.watch_hour_sessions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_watch_hour_sessions_content ON public.watch_hour_sessions(user_id, content_type, episode_id, movie_id);
CREATE INDEX IF NOT EXISTS idx_watch_hour_reward_credits_user ON public.watch_hour_reward_credits(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_watch_hour_reward_credits_reference ON public.watch_hour_reward_credits(reference);

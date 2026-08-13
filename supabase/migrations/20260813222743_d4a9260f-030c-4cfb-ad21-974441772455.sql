CREATE OR REPLACE FUNCTION public.get_creator_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('has_profile', false);
  END IF;

  SELECT id INTO v_profile_id
  FROM public.creator_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('has_profile', false);
  END IF;

  WITH owned AS (
    SELECT content_id, content_type
    FROM public.content_creators
    WHERE creator_profile_id = v_profile_id
  ),
  own_movies AS (SELECT content_id AS id FROM owned WHERE content_type = 'movie'),
  own_shows AS (SELECT content_id AS id FROM owned WHERE content_type = 'tv_show'),
  own_seasons AS (
    SELECT s.id, s.tv_show_id
    FROM public.seasons s
    JOIN own_shows o ON o.id = s.tv_show_id
  ),
  own_eps AS (
    SELECT e.id FROM public.episodes e JOIN own_seasons os ON os.id = e.season_id
    UNION
    SELECT e.id FROM public.episodes e JOIN owned o ON o.content_id = e.id AND o.content_type = 'episode'
  ),
  titles AS (
    SELECT 'movie'::text AS ctype, m.id, m.title
    FROM public.movies m JOIN own_movies om ON om.id = m.id
    UNION ALL
    SELECT 'tv_show'::text, t.id, t.title
    FROM public.tv_shows t JOIN own_shows os ON os.id = t.id
    UNION ALL
    SELECT 'episode'::text, e.id, e.title
    FROM public.episodes e JOIN own_eps oe ON oe.id = e.id
  ),
  rentals AS (
    SELECT
      ri.id,
      ri.price,
      ri.paid_at,
      ri.rental_type,
      ri.payment_method,
      COALESCE(
        (SELECT m.title FROM public.movies m WHERE m.id = ri.movie_id),
        (SELECT t.title || ' — Season ' || s.season_number
           FROM public.seasons s JOIN public.tv_shows t ON t.id = s.tv_show_id
          WHERE s.id = ri.season_id),
        (SELECT e.title FROM public.episodes e WHERE e.id = ri.episode_id),
        'Untitled'
      ) AS title
    FROM public.rental_intents ri
    WHERE ri.status = 'paid'
      AND (
        ri.movie_id IN (SELECT id FROM own_movies)
        OR ri.season_id IN (SELECT id FROM own_seasons)
        OR ri.episode_id IN (SELECT id FROM own_eps)
      )
  )
  SELECT jsonb_build_object(
    'has_profile', true,
    'profile', (
      SELECT jsonb_build_object(
        'id', cp.id,
        'display_name', cp.display_name,
        'company_name', cp.company_name,
        'creator_type', cp.creator_type,
        'status', cp.status,
        'email', cp.email
      )
      FROM public.creator_profiles cp WHERE cp.id = v_profile_id
    ),
    'content', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('content_type', ctype, 'id', id, 'title', title))
      FROM (SELECT * FROM titles ORDER BY ctype, title) t
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'titles', (SELECT count(*) FROM titles),
      'total_revenue', (SELECT COALESCE(SUM(price), 0) FROM rentals),
      'rentals_count', (SELECT count(*) FROM rentals),
      'revenue_30d', (SELECT COALESCE(SUM(price), 0) FROM rentals WHERE paid_at >= now() - INTERVAL '30 days'),
      'rentals_30d', (SELECT count(*) FROM rentals WHERE paid_at >= now() - INTERVAL '30 days'),
      'views', (SELECT count(*) FROM public.watch_history wh WHERE wh.content_id IN (SELECT id FROM titles)),
      'active_access', (
        SELECT count(*) FROM public.rental_access ra
        WHERE ra.revoked_at IS NULL
          AND ra.status = 'paid'
          AND ra.expires_at > now()
          AND (
            ra.movie_id IN (SELECT id FROM own_movies)
            OR ra.season_id IN (SELECT id FROM own_seasons)
            OR ra.episode_id IN (SELECT id FROM own_eps)
          )
      )
    ),
    'by_title', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'title', q.title,
        'rental_type', q.rental_type,
        'rentals', q.rentals,
        'revenue', q.revenue
      ))
      FROM (
        SELECT title, rental_type, count(*) AS rentals, SUM(price) AS revenue
        FROM rentals
        GROUP BY title, rental_type
        ORDER BY SUM(price) DESC
      ) q
    ), '[]'::jsonb),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', d.day, 'revenue', d.revenue, 'rentals', d.rentals))
      FROM (
        SELECT date_trunc('day', paid_at)::date AS day, SUM(price) AS revenue, count(*) AS rentals
        FROM rentals
        WHERE paid_at >= now() - INTERVAL '30 days'
        GROUP BY 1
        ORDER BY 1
      ) d
    ), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'title', r.title,
        'rental_type', r.rental_type,
        'payment_method', r.payment_method,
        'price', r.price,
        'paid_at', r.paid_at
      ))
      FROM (SELECT * FROM rentals ORDER BY paid_at DESC NULLS LAST LIMIT 25) r
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_creator_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_creator_dashboard() TO authenticated;
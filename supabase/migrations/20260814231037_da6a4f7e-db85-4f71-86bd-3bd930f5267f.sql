CREATE OR REPLACE VIEW public.v_admin_rental_records
WITH (security_invoker = on) AS
SELECT
  i.id                                        AS intent_id,
  i.user_id,
  p.name                                      AS user_name,
  p.email                                     AS user_email,
  i.rental_type                                AS content_type,
  COALESCE(i.movie_id, i.season_id, i.episode_id) AS content_id,
  CASE
    WHEN i.movie_id IS NOT NULL THEN m.title
    WHEN i.season_id IS NOT NULL THEN COALESCE(ts.title || ' — Season ' || s.season_number::text, 'Season ' || s.season_number::text)
    WHEN i.episode_id IS NOT NULL THEN COALESCE(ets.title || ' — S' || es.season_number::text || 'E' || e.episode_number::text || ': ' || e.title, e.title)
    ELSE 'Unknown Content'
  END                                          AS content_title,
  i.price                                      AS amount,
  i.discount_amount,
  i.payment_method,
  i.status                                     AS payment_status,
  i.paystack_reference,
  i.provider_reference,
  i.created_at,
  i.paid_at,
  ra.id                                        AS access_id,
  ra.expires_at,
  ra.revoked_at,
  CASE
    WHEN ra.id IS NULL THEN 'none'
    WHEN ra.revoked_at IS NOT NULL THEN 'revoked'
    WHEN ra.expires_at > now() THEN 'active'
    ELSE 'expired'
  END                                          AS rental_status
FROM public.rental_intents i
LEFT JOIN public.profiles p ON p.user_id = i.user_id
LEFT JOIN public.movies m ON m.id = i.movie_id
LEFT JOIN public.seasons s ON s.id = i.season_id
LEFT JOIN public.tv_shows ts ON ts.id = s.tv_show_id
LEFT JOIN public.episodes e ON e.id = i.episode_id
LEFT JOIN public.seasons es ON es.id = e.season_id
LEFT JOIN public.tv_shows ets ON ets.id = es.tv_show_id
LEFT JOIN LATERAL (
  SELECT r.id, r.expires_at, r.revoked_at
  FROM public.rental_access r
  WHERE r.rental_intent_id = i.id
  ORDER BY r.created_at DESC
  LIMIT 1
) ra ON true;

GRANT SELECT ON public.v_admin_rental_records TO authenticated;
GRANT SELECT ON public.v_admin_rental_records TO service_role;
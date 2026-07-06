CREATE OR REPLACE VIEW public.v_user_entitlements AS
WITH active_access AS (
  SELECT
    ra.user_id,
    COALESCE(ra.movie_id, ra.season_id, ra.episode_id) AS content_id,
    ra.rental_type AS content_type,
    'ACTIVE'::text AS state,
    ra.expires_at,
    COALESCE(ra.rental_intent_id, ri.id) AS intent_id,
    ra.id AS access_id,
    COALESCE(ri.payment_method, ra.source) AS payment_method,
    ri.created_at AS intent_created_at,
    ra.created_at AS access_created_at,
    GREATEST(
      COALESCE(ri.updated_at, ri.created_at, ra.updated_at, ra.created_at),
      COALESCE(ra.updated_at, ra.created_at)
    ) AS last_updated_at,
    ri.status AS intent_status,
    ra.status AS access_status,
    ra.revoked_at
  FROM public.rental_access ra
  LEFT JOIN public.rental_intents ri ON ri.id = ra.rental_intent_id
  WHERE ra.status = 'paid'::public.rental_intent_status
    AND ra.revoked_at IS NULL
    AND ra.expires_at > now()
),
terminal_access AS (
  SELECT
    ra.user_id,
    COALESCE(ra.movie_id, ra.season_id, ra.episode_id) AS content_id,
    ra.rental_type AS content_type,
    CASE
      WHEN ra.revoked_at IS NOT NULL THEN 'REVOKED'::text
      WHEN ra.expires_at <= now() THEN 'EXPIRED'::text
      ELSE 'NOT_RENTED'::text
    END AS state,
    ra.expires_at,
    COALESCE(ra.rental_intent_id, ri.id) AS intent_id,
    ra.id AS access_id,
    COALESCE(ri.payment_method, ra.source) AS payment_method,
    ri.created_at AS intent_created_at,
    ra.created_at AS access_created_at,
    GREATEST(
      COALESCE(ri.updated_at, ri.created_at, ra.updated_at, ra.created_at),
      COALESCE(ra.updated_at, ra.created_at)
    ) AS last_updated_at,
    ri.status AS intent_status,
    ra.status AS access_status,
    ra.revoked_at
  FROM public.rental_access ra
  LEFT JOIN public.rental_intents ri ON ri.id = ra.rental_intent_id
  WHERE NOT (
    ra.status = 'paid'::public.rental_intent_status
    AND ra.revoked_at IS NULL
    AND ra.expires_at > now()
  )
),
intent_rows AS (
  SELECT
    ri.user_id,
    COALESCE(ri.movie_id, ri.season_id, ri.episode_id) AS content_id,
    ri.rental_type AS content_type,
    CASE
      WHEN ri.status = 'paid'::public.rental_intent_status THEN 'NOT_RENTED'::text
      WHEN ri.status = 'failed'::public.rental_intent_status THEN 'FAILED'::text
      WHEN ri.status = 'pending'::public.rental_intent_status AND ri.payment_method = 'wallet' AND ri.created_at <= now() - interval '5 minutes' THEN 'FAILED'::text
      WHEN ri.status = 'pending'::public.rental_intent_status AND ri.payment_method = 'paystack' AND ri.created_at <= now() - interval '30 minutes' THEN 'FAILED'::text
      WHEN ri.status = 'pending'::public.rental_intent_status AND ri.expires_at <= now() THEN 'FAILED'::text
      WHEN ri.payment_method = 'wallet' AND ri.status = 'pending'::public.rental_intent_status THEN 'PAYMENT_PENDING'::text
      WHEN ri.payment_method = 'paystack' AND ri.status = 'pending'::public.rental_intent_status THEN 'PAYMENT_VERIFICATION'::text
      WHEN ri.status = 'pending'::public.rental_intent_status THEN 'PAYMENT_PENDING'::text
      ELSE 'NOT_RENTED'::text
    END AS state,
    ri.expires_at,
    ri.id AS intent_id,
    NULL::uuid AS access_id,
    ri.payment_method,
    ri.created_at AS intent_created_at,
    NULL::timestamptz AS access_created_at,
    COALESCE(ri.updated_at, ri.created_at) AS last_updated_at,
    ri.status AS intent_status,
    NULL::public.rental_intent_status AS access_status,
    NULL::timestamptz AS revoked_at
  FROM public.rental_intents ri
  WHERE NOT EXISTS (
    SELECT 1
    FROM active_access aa
    WHERE aa.user_id = ri.user_id
      AND aa.content_id = COALESCE(ri.movie_id, ri.season_id, ri.episode_id)
      AND aa.content_type = ri.rental_type
  )
    AND NOT EXISTS (
      SELECT 1
      FROM public.rental_access ra
      WHERE ra.rental_intent_id = ri.id
    )
)
SELECT * FROM active_access
UNION ALL
SELECT * FROM intent_rows
UNION ALL
SELECT * FROM terminal_access
WHERE NOT EXISTS (
  SELECT 1
  FROM active_access aa
  WHERE aa.user_id = terminal_access.user_id
    AND aa.content_id = terminal_access.content_id
    AND aa.content_type = terminal_access.content_type
);

GRANT SELECT ON public.v_user_entitlements TO authenticated;
GRANT SELECT ON public.v_user_entitlements TO service_role;
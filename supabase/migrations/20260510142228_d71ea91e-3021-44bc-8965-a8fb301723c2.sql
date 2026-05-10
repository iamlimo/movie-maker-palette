CREATE OR REPLACE VIEW public.v_user_entitlements
WITH (security_invoker = true)
AS
WITH access_rows AS (
  SELECT
    ra.user_id,
    COALESCE(ra.movie_id, ra.season_id, ra.episode_id) AS content_id,
    ra.rental_type AS content_type,
    ra.id AS access_id,
    ra.rental_intent_id,
    ra.status::text AS access_status,
    ra.expires_at,
    ra.granted_at,
    ra.revoked_at,
    ROW_NUMBER() OVER (
      PARTITION BY ra.user_id, COALESCE(ra.movie_id, ra.season_id, ra.episode_id), ra.rental_type
      ORDER BY
        CASE WHEN ra.revoked_at IS NULL AND ra.expires_at > now() THEN 0 ELSE 1 END,
        ra.expires_at DESC NULLS LAST
    ) AS rn
  FROM public.rental_access ra
),
intent_rows AS (
  SELECT
    ri.user_id,
    COALESCE(ri.movie_id, ri.season_id, ri.episode_id) AS content_id,
    ri.rental_type AS content_type,
    ri.id AS intent_id,
    ri.status::text AS intent_status,
    ri.payment_method,
    ri.price,
    ri.currency,
    ri.expires_at AS intent_expires_at,
    ri.created_at AS intent_created_at,
    ROW_NUMBER() OVER (
      PARTITION BY ri.user_id, COALESCE(ri.movie_id, ri.season_id, ri.episode_id), ri.rental_type
      ORDER BY ri.created_at DESC
    ) AS rn
  FROM public.rental_intents ri
)
SELECT
  COALESCE(a.user_id, i.user_id) AS user_id,
  COALESCE(a.content_id, i.content_id) AS content_id,
  COALESCE(a.content_type, i.content_type) AS content_type,
  a.access_id,
  i.intent_id,
  a.expires_at,
  i.payment_method,
  i.intent_status,
  a.access_status,
  a.revoked_at,
  CASE
    WHEN a.access_id IS NOT NULL
         AND a.revoked_at IS NULL
         AND a.access_status = 'paid'
         AND a.expires_at > now()
      THEN 'ACTIVE'
    WHEN a.revoked_at IS NOT NULL
      THEN 'REVOKED'
    WHEN a.access_id IS NOT NULL
         AND a.expires_at <= now()
      THEN 'EXPIRED'
    WHEN i.intent_status = 'pending' AND i.payment_method = 'wallet'
      THEN 'PAYMENT_PENDING'
    WHEN i.intent_status = 'pending' AND i.payment_method = 'paystack'
      THEN 'PAYMENT_VERIFICATION'
    WHEN i.intent_status = 'failed'
      THEN 'FAILED'
    ELSE 'NOT_RENTED'
  END AS state
FROM access_rows a
FULL OUTER JOIN intent_rows i
  ON i.user_id = a.user_id
 AND i.content_id = a.content_id
 AND i.content_type = a.content_type
 AND i.rn = 1
WHERE (a.rn IS NULL OR a.rn = 1)
  AND (i.rn IS NULL OR i.rn = 1);

COMMENT ON VIEW public.v_user_entitlements IS
  'Derived rental entitlement state per (user, content). Single source of truth for frontend rental UI.';

CREATE INDEX IF NOT EXISTS idx_rental_intents_user_content_pending
  ON public.rental_intents (user_id, rental_type, created_at DESC)
  WHERE status = 'pending';
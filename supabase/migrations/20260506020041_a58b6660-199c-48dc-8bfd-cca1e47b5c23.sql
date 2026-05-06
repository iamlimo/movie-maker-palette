
WITH ranked AS (
  SELECT
    p.id              AS payment_id,
    p.user_id,
    p.amount,
    p.intent_id,
    p.provider_reference,
    p.metadata,
    p.created_at,
    LOWER(COALESCE(p.metadata->>'content_type', 'movie')) AS content_type,
    (p.metadata->>'content_id')::uuid AS content_id,
    ROW_NUMBER() OVER (
      PARTITION BY p.user_id, (p.metadata->>'content_id'), LOWER(COALESCE(p.metadata->>'content_type','movie'))
      ORDER BY p.created_at DESC
    ) AS rn
  FROM public.payments p
  WHERE p.purpose = 'rental'
    AND p.provider = 'paystack'
    AND COALESCE(p.enhanced_status::text, p.status::text) IN ('pending','initiated')
    AND p.created_at > now() - interval '7 days'
    AND (p.metadata ? 'content_id')
    AND (p.metadata ->> 'rental_intent_id') IS NULL
),
candidates AS (
  SELECT * FROM ranked
  WHERE rn = 1
    AND content_type IN ('movie','season','episode')
    AND NOT EXISTS (
      SELECT 1 FROM public.rental_intents ri
      WHERE ri.user_id = ranked.user_id
        AND ri.status = 'pending'
        AND (
          (ranked.content_type = 'movie'   AND ri.movie_id = ranked.content_id) OR
          (ranked.content_type = 'season'  AND ri.season_id = ranked.content_id) OR
          (ranked.content_type = 'episode' AND ri.episode_id = ranked.content_id)
        )
    )
),
inserted AS (
  INSERT INTO public.rental_intents (
    user_id, movie_id, season_id, episode_id,
    rental_type, price, currency, payment_method, status,
    provider_reference, paystack_reference,
    expires_at, metadata, created_at
  )
  SELECT
    c.user_id,
    CASE WHEN c.content_type = 'movie'   THEN c.content_id END,
    CASE WHEN c.content_type = 'season'  THEN c.content_id END,
    CASE WHEN c.content_type = 'episode' THEN c.content_id END,
    c.content_type,
    ROUND(c.amount)::bigint,
    'NGN',
    'paystack',
    'pending',
    COALESCE(c.provider_reference, c.intent_id),
    COALESCE(c.provider_reference, c.intent_id),
    c.created_at + interval '48 hours',
    COALESCE(c.metadata, '{}'::jsonb),
    c.created_at
  FROM candidates c
  RETURNING id, provider_reference
)
UPDATE public.payments p
SET metadata = COALESCE(p.metadata, '{}'::jsonb)
              || jsonb_build_object('rental_intent_id', i.id)
FROM inserted i
WHERE COALESCE(p.provider_reference, p.intent_id) = i.provider_reference
  AND p.purpose = 'rental';

-- Non-destructive rental monetization upgrade
-- Adds rental intents and rental access tables to support unified payment -> intent -> access flow.
-- Preserves existing rentals data and compatibility.

BEGIN;

-- 1) Canonical rental intent status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'rental_intent_status'
  ) THEN
    CREATE TYPE public.rental_intent_status AS ENUM ('pending', 'paid', 'failed');
  END IF;
END $$;

-- 2) Rental intents table
CREATE TABLE IF NOT EXISTS public.rental_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,

  -- Unified nullable content references
  movie_id UUID NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  season_id UUID NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  episode_id UUID NULL REFERENCES public.episodes(id) ON DELETE CASCADE,

  rental_type TEXT NOT NULL CHECK (rental_type IN ('movie', 'season', 'episode')),
  price BIGINT NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('wallet', 'paystack')),

  status public.rental_intent_status NOT NULL DEFAULT 'pending',
  provider_reference TEXT NULL,
  paystack_reference TEXT NULL,
  referral_code TEXT NULL,
  discount_amount BIGINT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  expires_at TIMESTAMPTZ NULL,
  paid_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rental_intents_content_match CHECK (
    (
      rental_type = 'movie' AND movie_id IS NOT NULL AND season_id IS NULL AND episode_id IS NULL
    ) OR (
      rental_type = 'season' AND season_id IS NOT NULL AND movie_id IS NULL AND episode_id IS NULL
    ) OR (
      rental_type = 'episode' AND episode_id IS NOT NULL AND movie_id IS NULL AND season_id IS NULL
    )
  )
);

-- 3) Rental access table
CREATE TABLE IF NOT EXISTS public.rental_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,

  movie_id UUID NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  season_id UUID NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  episode_id UUID NULL REFERENCES public.episodes(id) ON DELETE CASCADE,

  rental_type TEXT NOT NULL CHECK (rental_type IN ('movie', 'season', 'episode')),
  status public.rental_intent_status NOT NULL DEFAULT 'pending',

  rental_intent_id UUID NULL REFERENCES public.rental_intents(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'rental' CHECK (source IN ('rental', 'purchase', 'admin_grant')),

  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rental_access_content_match CHECK (
    (
      rental_type = 'movie' AND movie_id IS NOT NULL AND season_id IS NULL AND episode_id IS NULL
    ) OR (
      rental_type = 'season' AND season_id IS NOT NULL AND movie_id IS NULL AND episode_id IS NULL
    ) OR (
      rental_type = 'episode' AND episode_id IS NOT NULL AND movie_id IS NULL AND season_id IS NULL
    )
  )
);

-- 4) Helpful indexes for intent lookup, access checks, and expiry scans
CREATE INDEX IF NOT EXISTS idx_rental_intents_user_id ON public.rental_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_rental_intents_movie_id ON public.rental_intents(movie_id) WHERE movie_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rental_intents_season_id ON public.rental_intents(season_id) WHERE season_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rental_intents_episode_id ON public.rental_intents(episode_id) WHERE episode_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rental_intents_status ON public.rental_intents(status);
CREATE INDEX IF NOT EXISTS idx_rental_intents_expires_at ON public.rental_intents(expires_at);
CREATE INDEX IF NOT EXISTS idx_rental_intents_provider_reference ON public.rental_intents(provider_reference);
CREATE INDEX IF NOT EXISTS idx_rental_intents_paystack_reference ON public.rental_intents(paystack_reference);

CREATE INDEX IF NOT EXISTS idx_rental_access_user_id ON public.rental_access(user_id);
CREATE INDEX IF NOT EXISTS idx_rental_access_movie_id ON public.rental_access(movie_id) WHERE movie_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rental_access_season_id ON public.rental_access(season_id) WHERE season_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rental_access_episode_id ON public.rental_access(episode_id) WHERE episode_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rental_access_status ON public.rental_access(status);
CREATE INDEX IF NOT EXISTS idx_rental_access_expires_at ON public.rental_access(expires_at);

-- 5) Prevent duplicate active rentals for the same user + content
-- Note: only pending intents and currently active access rows are constrained.
-- Expired access rows are marked expired before re-granting so users can re-rent after expiry.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_intents_pending_movie
  ON public.rental_intents(user_id, movie_id)
  WHERE movie_id IS NOT NULL AND status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_intents_pending_season
  ON public.rental_intents(user_id, season_id)
  WHERE season_id IS NOT NULL AND status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_intents_pending_episode
  ON public.rental_intents(user_id, episode_id)
  WHERE episode_id IS NOT NULL AND status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_access_active_movie
  ON public.rental_access(user_id, movie_id)
  WHERE movie_id IS NOT NULL AND revoked_at IS NULL AND status = 'paid';

CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_access_active_season
  ON public.rental_access(user_id, season_id)
  WHERE season_id IS NOT NULL AND revoked_at IS NULL AND status = 'paid';

CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_access_active_episode
  ON public.rental_access(user_id, episode_id)
  WHERE episode_id IS NOT NULL AND revoked_at IS NULL AND status = 'paid';

-- 6) Timestamp maintenance trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rental_intents_updated_at ON public.rental_intents;
CREATE TRIGGER trg_rental_intents_updated_at
BEFORE UPDATE ON public.rental_intents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_rental_access_updated_at ON public.rental_access;
CREATE TRIGGER trg_rental_access_updated_at
BEFORE UPDATE ON public.rental_access
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

-- 7) RPC helpers for efficient access checks and granting access
-- This minimizes frontend queries and avoids repeated logic in edge functions.

CREATE OR REPLACE FUNCTION public.has_active_rental_access(
  p_user_id UUID,
  p_content_id UUID,
  p_content_type TEXT
)
RETURNS TABLE (
  has_access BOOLEAN,
  access_type TEXT,
  expires_at TIMESTAMPTZ,
  rental_access_id UUID
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH direct_access AS (
    SELECT
      ra.id,
      ra.rental_type,
      ra.expires_at
    FROM public.rental_access ra
    WHERE ra.user_id = p_user_id
      AND ra.revoked_at IS NULL
      AND ra.status = 'paid'
      AND ra.expires_at > now()
      AND (
        (p_content_type = 'movie' AND ra.movie_id = p_content_id) OR
        (p_content_type = 'season' AND ra.season_id = p_content_id) OR
        (p_content_type = 'episode' AND ra.episode_id = p_content_id)
      )
    ORDER BY ra.expires_at DESC
    LIMIT 1
  ),
  episode_via_season AS (
    SELECT
      ra.id,
      ra.rental_type,
      ra.expires_at
    FROM public.episodes e
    JOIN public.rental_access ra
      ON ra.user_id = p_user_id
     AND ra.revoked_at IS NULL
     AND ra.status = 'paid'
     AND ra.expires_at > now()
     AND ra.season_id = e.season_id
    WHERE p_content_type = 'episode'
      AND e.id = p_content_id
    ORDER BY ra.expires_at DESC
    LIMIT 1
  )
  SELECT
    TRUE,
    COALESCE(direct_access.rental_type, episode_via_season.rental_type),
    COALESCE(direct_access.expires_at, episode_via_season.expires_at),
    COALESCE(direct_access.id, episode_via_season.id)
  FROM direct_access
  FULL OUTER JOIN episode_via_season ON TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::UUID;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_rental_access(
  p_user_id UUID,
  p_content_id UUID,
  p_content_type TEXT,
  p_rental_type TEXT,
  p_expires_at TIMESTAMPTZ,
  p_rental_intent_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'rental',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_access_id UUID;
BEGIN
  IF p_content_type NOT IN ('movie', 'season', 'episode') THEN
    RAISE EXCEPTION 'Invalid content type: %', p_content_type;
  END IF;

  -- Release any expired row for the same user/content so re-rentals are allowed.
  UPDATE public.rental_access
    SET status = 'failed',
        updated_at = now()
  WHERE user_id = p_user_id
    AND revoked_at IS NULL
    AND status = 'paid'
    AND expires_at <= now()
    AND (
      (p_content_type = 'movie' AND movie_id = p_content_id) OR
      (p_content_type = 'season' AND season_id = p_content_id) OR
      (p_content_type = 'episode' AND episode_id = p_content_id)
    );

  INSERT INTO public.rental_access (
    user_id,
    movie_id,
    season_id,
    episode_id,
    rental_type,
    status,
    rental_intent_id,
    source,
    granted_at,
    expires_at,
    metadata
  )
  VALUES (
    p_user_id,
    CASE WHEN p_content_type = 'movie' THEN p_content_id ELSE NULL END,
    CASE WHEN p_content_type = 'season' THEN p_content_id ELSE NULL END,
    CASE WHEN p_content_type = 'episode' THEN p_content_id ELSE NULL END,
    p_rental_type,
    'paid',
    p_rental_intent_id,
    p_source,
    now(),
    p_expires_at,
    p_metadata
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_access_id;

  IF v_access_id IS NULL THEN
    SELECT id
      INTO v_access_id
    FROM public.rental_access
    WHERE user_id = p_user_id
      AND revoked_at IS NULL
      AND expires_at > now()
      AND (
        (p_content_type = 'movie' AND movie_id = p_content_id) OR
        (p_content_type = 'season' AND season_id = p_content_id) OR
        (p_content_type = 'episode' AND episode_id = p_content_id)
      )
    ORDER BY expires_at DESC
    LIMIT 1;
  END IF;

  RETURN v_access_id;
END;
$$;

-- 8) Keep old rentals table data intact, but add compatibility notes through comments
COMMENT ON TABLE public.rental_intents IS 'Rental payment workflow record: intent -> payment verification -> access grant';
COMMENT ON TABLE public.rental_access IS 'Canonical access grant table used by playback authorization; supports movie/season/episode access';

-- 9) Atomic wallet rental processor
-- This keeps wallet debit, intent creation, and access grant in a single transaction.
CREATE OR REPLACE FUNCTION public.process_wallet_rental_payment(
  p_user_id UUID,
  p_content_id UUID,
  p_content_type TEXT,
  p_final_price BIGINT,
  p_expires_at TIMESTAMPTZ,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_referral_code TEXT DEFAULT NULL,
  p_discount_amount BIGINT DEFAULT 0,
  p_provider_reference TEXT DEFAULT NULL
)
RETURNS TABLE (
  rental_intent_id UUID,
  rental_access_id UUID,
  wallet_balance BIGINT,
  final_price BIGINT,
  discount_amount BIGINT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_balance NUMERIC;
  v_has_access BOOLEAN := false;
  v_existing_access_id UUID;
  v_intent_id UUID;
  v_access_id UUID;
  v_movie_id UUID;
  v_season_id UUID;
  v_episode_id UUID;
  v_rental_type TEXT := lower(trim(p_content_type));
  v_new_balance NUMERIC;
BEGIN
  IF v_rental_type NOT IN ('movie', 'season', 'episode') THEN
    RAISE EXCEPTION 'Invalid content type: %', p_content_type;
  END IF;

  -- Release any expired row for the same user/content so re-rentals are allowed.
  UPDATE public.rental_access
    SET status = 'failed',
        updated_at = now()
  WHERE user_id = p_user_id
    AND revoked_at IS NULL
    AND status = 'paid'
    AND expires_at <= now()
    AND (
      (v_rental_type = 'movie' AND movie_id = p_content_id) OR
      (v_rental_type = 'season' AND season_id = p_content_id) OR
      (v_rental_type = 'episode' AND episode_id = p_content_id)
    );

  SELECT has_access, rental_access_id
    INTO v_has_access, v_existing_access_id
  FROM public.has_active_rental_access(p_user_id, p_content_id, v_rental_type)
  LIMIT 1;

  IF COALESCE(v_has_access, false) THEN
    RAISE EXCEPTION 'Active rental exists';
  END IF;

  SELECT balance
    INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF v_wallet_balance < p_final_price THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  v_movie_id := CASE WHEN v_rental_type = 'movie' THEN p_content_id ELSE NULL END;
  v_season_id := CASE WHEN v_rental_type = 'season' THEN p_content_id ELSE NULL END;
  v_episode_id := CASE WHEN v_rental_type = 'episode' THEN p_content_id ELSE NULL END;

  UPDATE public.wallets
    SET balance = balance - p_final_price
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.rental_intents (
    user_id,
    movie_id,
    season_id,
    episode_id,
    rental_type,
    price,
    currency,
    payment_method,
    status,
    provider_reference,
    referral_code,
    discount_amount,
    metadata,
    expires_at,
    paid_at
  )
  VALUES (
    p_user_id,
    v_movie_id,
    v_season_id,
    v_episode_id,
    v_rental_type,
    p_final_price,
    'NGN',
    'wallet',
    'paid',
    p_provider_reference,
    p_referral_code,
    COALESCE(p_discount_amount, 0),
    COALESCE(p_metadata, '{}'::jsonb),
    p_expires_at,
    now()
  )
  RETURNING id INTO v_intent_id;

  INSERT INTO public.rental_access (
    user_id,
    movie_id,
    season_id,
    episode_id,
    rental_type,
    status,
    rental_intent_id,
    source,
    granted_at,
    expires_at,
    metadata
  )
  VALUES (
    p_user_id,
    v_movie_id,
    v_season_id,
    v_episode_id,
    v_rental_type,
    'paid',
    v_intent_id,
    'rental',
    now(),
    p_expires_at,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_access_id;

  IF v_access_id IS NULL THEN
    SELECT ra.id
      INTO v_access_id
    FROM public.rental_access ra
    WHERE ra.user_id = p_user_id
      AND ra.revoked_at IS NULL
      AND ra.expires_at > now()
      AND (
        (v_rental_type = 'movie' AND ra.movie_id = p_content_id) OR
        (v_rental_type = 'season' AND ra.season_id = p_content_id) OR
        (v_rental_type = 'episode' AND ra.episode_id = p_content_id)
      )
    ORDER BY ra.expires_at DESC
    LIMIT 1;
  END IF;

  rental_intent_id := v_intent_id;
  rental_access_id := v_access_id;
  wallet_balance := v_new_balance::BIGINT;
  final_price := p_final_price;
  discount_amount := COALESCE(p_discount_amount, 0);
  expires_at := p_expires_at;

  RETURN NEXT;
END;
$$;

COMMIT;

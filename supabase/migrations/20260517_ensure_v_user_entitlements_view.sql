-- CRITICAL FIX: Ensure v_user_entitlements view exists and properly handles state transitions
-- This view is the single source of truth for rental entitlement states
-- Used by: useEntitlements hook (frontend)

-- Drop existing view if it exists (safe - no data, just a view)
DROP VIEW IF EXISTS public.v_user_entitlements;

-- Recreate the canonical entitlements view
-- Maps rental_intents + rental_access into a unified entitlement state machine
-- Normalizes separate ID columns (movie_id, season_id, episode_id) into unified content_id/content_type
CREATE VIEW public.v_user_entitlements AS

-- Extract content_id and content_type from rental_intents (movie/season/episode)
WITH normalized_intents AS (
  SELECT
    ri.id,
    ri.user_id,
    COALESCE(ri.movie_id, ri.season_id, ri.episode_id) AS content_id,
    ri.rental_type AS content_type,
    ri.status,
    ri.payment_method,
    ri.created_at,
    ri.updated_at
  FROM public.rental_intents ri
),

-- Extract content_id and content_type from rental_access (movie/season/episode)
normalized_access AS (
  SELECT
    ra.id,
    ra.user_id,
    COALESCE(ra.movie_id, ra.season_id, ra.episode_id) AS content_id,
    ra.rental_type AS content_type,
    ra.status,
    ra.expires_at,
    ra.revoked_at,
    ra.created_at,
    ra.updated_at,
    ra.rental_intent_id
  FROM public.rental_access ra
)

-- Main query: join intents + access, then add orphaned access records
SELECT
  COALESCE(ni.user_id, na.user_id) AS user_id,
  COALESCE(ni.content_id, na.content_id) AS content_id,
  COALESCE(ni.content_type, na.content_type) AS content_type,
  
  -- Entitlement state machine
  CASE
    -- ACTIVE: User has a valid, non-expired rental_access
    WHEN na.id IS NOT NULL 
      AND na.status = 'paid' 
      AND na.revoked_at IS NULL 
      AND na.expires_at > NOW()
    THEN 'ACTIVE'
    
    -- EXPIRED: rental_access exists but is past expiry
    WHEN na.id IS NOT NULL 
      AND na.status = 'paid' 
      AND na.revoked_at IS NULL 
      AND na.expires_at <= NOW()
    THEN 'EXPIRED'
    
    -- REVOKED: rental_access was explicitly revoked
    WHEN na.id IS NOT NULL 
      AND na.revoked_at IS NOT NULL
    THEN 'REVOKED'
    
    -- PAYMENT_PENDING: Wallet payment in progress (transient, usually instant)
    WHEN ni.payment_method = 'wallet' 
      AND ni.status = 'pending'
      AND (na.id IS NULL OR na.status != 'paid')
    THEN 'PAYMENT_PENDING'
    
    -- PAYMENT_VERIFICATION: Paystack payment awaiting webhook confirmation
    WHEN ni.payment_method = 'paystack' 
      AND ni.status = 'pending'
      AND (na.id IS NULL OR na.status != 'paid')
    THEN 'PAYMENT_VERIFICATION'
    
    -- FAILED: Payment failed or was cancelled
    WHEN ni.status = 'failed'
    THEN 'FAILED'
    
    -- NOT_RENTED: No rental intent or access found
    ELSE 'NOT_RENTED'
  END AS state,
  
  na.expires_at,
  ni.id AS intent_id,
  na.id AS access_id,
  ni.payment_method,
  ni.created_at AS intent_created_at,
  na.created_at AS access_created_at,
  GREATEST(COALESCE(ni.updated_at, ni.created_at), COALESCE(na.updated_at, na.created_at)) AS last_updated_at

FROM normalized_intents ni
LEFT JOIN normalized_access na
  ON ni.user_id = na.user_id
    AND ni.content_id = na.content_id
    AND ni.content_type = na.content_type

UNION ALL

-- Include rental_access records without matching rental_intents (edge case)
SELECT
  na.user_id,
  na.content_id,
  na.content_type,
  
  CASE
    WHEN na.status = 'paid' 
      AND na.revoked_at IS NULL 
      AND na.expires_at > NOW()
    THEN 'ACTIVE'
    
    WHEN na.status = 'paid' 
      AND na.revoked_at IS NULL 
      AND na.expires_at <= NOW()
    THEN 'EXPIRED'
    
    WHEN na.revoked_at IS NOT NULL
    THEN 'REVOKED'
    
    ELSE 'NOT_RENTED'
  END AS state,
  
  na.expires_at,
  NULL::UUID AS intent_id,
  na.id AS access_id,
  NULL::TEXT AS payment_method,
  NULL::TIMESTAMP WITH TIME ZONE AS intent_created_at,
  na.created_at AS access_created_at,
  na.updated_at AS last_updated_at

FROM normalized_access na

WHERE
  -- Exclude records already covered by LEFT JOIN above
  NOT EXISTS (
    SELECT 1 FROM normalized_intents ni
    WHERE ni.user_id = na.user_id
      AND ni.content_id = na.content_id
      AND ni.content_type = na.content_type
  );

-- Create index for efficient queries by user
CREATE INDEX IF NOT EXISTS idx_v_user_entitlements_user 
  ON public.rental_intents(user_id);

-- Add index on rental_access for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rental_access_user_status 
  ON public.rental_access(user_id, status, revoked_at, expires_at);

-- Add index on rental_intents payment method for state checking
CREATE INDEX IF NOT EXISTS idx_rental_intents_payment_method 
  ON public.rental_intents(user_id, payment_method, status);

-- Document the view
COMMENT ON VIEW public.v_user_entitlements IS
  'Unified entitlement view - single source of truth for rental states.
  Combines rental_intents (payment lifecycle) + rental_access (entitlements) into deterministic state machine.
  States: NOT_RENTED | PAYMENT_PENDING | PAYMENT_VERIFICATION | ACTIVE | EXPIRED | FAILED | REVOKED
  Used by: useEntitlements hook (frontend)';

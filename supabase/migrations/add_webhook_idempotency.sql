-- Migration: Add webhook idempotency constraint
-- Purpose: Prevent duplicate rental_access rows when webhook is retried
-- Date: May 18, 2026
-- Impact: BREAKING - Ensures only one active paid rental per user+content

BEGIN;

-- Add unique constraint to rental_access table
-- This prevents webhook retries from creating duplicate rows
-- Constraint applies only to paid, non-revoked access
ALTER TABLE rental_access 
ADD CONSTRAINT unique_active_rental_per_content 
UNIQUE (
  user_id,
  COALESCE(movie_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(season_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(episode_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
WHERE status = 'paid' AND revoked_at IS NULL;

-- Verification query (run this after deployment):
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'rental_access' 
-- AND constraint_name = 'unique_active_rental_per_content';
-- Expected: 1 row with type = UNIQUE

COMMIT;

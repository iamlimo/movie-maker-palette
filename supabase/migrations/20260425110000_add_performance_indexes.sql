-- Performance Optimization: Additional Indexes & Strategies
-- Date: April 25, 2026
-- Purpose: Ensure optimal query performance for high-traffic scenarios

BEGIN;

-- ============================================================================
-- WALLET & PAYMENT INDEXES
-- ============================================================================

-- Index for wallet balance lookups (critical for payment processing)
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_balance ON public.wallets(balance);

-- Index for transaction ledger queries (financial auditing)
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_wallet_id ON public.transactions_ledger(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_created_at ON public.transactions_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_type_status ON public.transactions_ledger(transaction_type, status);

-- Index for payments table (audit & reconciliation)
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(enhanced_status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_provider_reference ON public.payments(provider_reference);

-- ============================================================================
-- RENTAL QUERY OPTIMIZATION
-- ============================================================================

-- Composite index for fastest rental access checks (user + content + expiry)
CREATE INDEX IF NOT EXISTS idx_rental_access_user_content_expiry 
  ON public.rental_access(user_id, movie_id, season_id, episode_id, expires_at DESC)
  WHERE revoked_at IS NULL AND status = 'paid';

-- Index for cleanup queries (finding expired rentals)
CREATE INDEX IF NOT EXISTS idx_rental_access_expires_at_revoked 
  ON public.rental_access(expires_at)
  WHERE revoked_at IS NULL;

-- Index for rental intent queries (payment reconciliation)
CREATE INDEX IF NOT EXISTS idx_rental_intents_status_created_at 
  ON public.rental_intents(status, created_at DESC);

-- Index for Paystack payment lookup
CREATE INDEX IF NOT EXISTS idx_rental_intents_paystack_status 
  ON public.rental_intents(paystack_reference, status)
  WHERE paystack_reference IS NOT NULL;

-- ============================================================================
-- REFERRAL CODE PERFORMANCE
-- ============================================================================

-- Index for referral code validation (during checkout)
CREATE INDEX IF NOT EXISTS idx_referral_codes_code_active 
  ON public.referral_codes(code) 
  WHERE is_active = true;

-- Index for referral code usage tracking
CREATE INDEX IF NOT EXISTS idx_referral_code_uses_user_code 
  ON public.referral_code_uses(user_id, code_id);

-- ============================================================================
-- CONTENT PRICING LOOKUP
-- ============================================================================

-- Index for movie rental price lookups
CREATE INDEX IF NOT EXISTS idx_movies_rental_price 
  ON public.movies(id, rental_price)
  WHERE rental_price > 0;

-- Index for season rental price lookups
CREATE INDEX IF NOT EXISTS idx_seasons_rental_price 
  ON public.seasons(id, rental_price)
  WHERE rental_price > 0;

-- Index for episode rental price lookups
CREATE INDEX IF NOT EXISTS idx_episodes_rental_price 
  ON public.episodes(id, rental_price, season_id)
  WHERE rental_price > 0;

-- Index for episode->season lookups (for access delegation)
CREATE INDEX IF NOT EXISTS idx_episodes_season_id 
  ON public.episodes(season_id, id);

-- ============================================================================
-- LEGACY RENTAL TABLE OPTIMIZATION (for backward compatibility)
-- ============================================================================

-- Composite index for rental queries
CREATE INDEX IF NOT EXISTS idx_rentals_user_content_status 
  ON public.rentals(user_id, content_id, content_type, status);

-- Index for expiry cleanup
CREATE INDEX IF NOT EXISTS idx_rentals_expires_at 
  ON public.rentals(expires_at)
  WHERE status != 'cancelled';

-- ============================================================================
-- QUERY PERFORMANCE CONFIGURATION
-- ============================================================================

-- Analyze table statistics for query planner
ANALYZE public.rental_intents;
ANALYZE public.rental_access;
ANALYZE public.wallets;
ANALYZE public.transactions_ledger;
ANALYZE public.payments;
ANALYZE public.rentals;

-- Set statistics target for better query planning on rental tables
ALTER TABLE public.rental_intents ALTER COLUMN user_id SET STATISTICS 100;
ALTER TABLE public.rental_intents ALTER COLUMN status SET STATISTICS 100;
ALTER TABLE public.rental_access ALTER COLUMN user_id SET STATISTICS 100;
ALTER TABLE public.rental_access ALTER COLUMN expires_at SET STATISTICS 100;

-- ============================================================================
-- MATERIALIZED VIEWS FOR ANALYTICS (Optional, for admin dashboard)
-- ============================================================================

-- View for rental activity (last 30 days)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_rental_activity_30d AS
SELECT
  DATE_TRUNC('day', ri.created_at) AS day,
  COUNT(*) AS total_rentals,
  COUNT(DISTINCT ri.user_id) AS unique_users,
  SUM(CASE WHEN ri.status = 'paid' THEN ri.price ELSE 0 END) AS revenue,
  ri.rental_type,
  COUNT(CASE WHEN ri.status = 'failed' THEN 1 END) AS failed_count
FROM public.rental_intents ri
WHERE ri.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', ri.created_at), ri.rental_type
ORDER BY day DESC;

CREATE INDEX IF NOT EXISTS idx_mv_rental_activity_day 
  ON public.mv_rental_activity_30d(day DESC);

-- View for wallet activity
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_wallet_stats AS
SELECT
  COUNT(DISTINCT user_id) AS total_users_with_wallet,
  SUM(balance) AS total_balance_kobo,
  AVG(balance) AS avg_balance_kobo,
  MIN(balance) AS min_balance_kobo,
  MAX(balance) AS max_balance_kobo,
  COUNT(CASE WHEN balance = 0 THEN 1 END) AS zero_balance_users,
  COUNT(CASE WHEN balance > 10000 THEN 1 END) AS premium_balance_users
FROM public.wallets;

-- Refresh materialized views daily (should be done via edge function schedule)
-- SELECT refresh_materialized_view('public.mv_rental_activity_30d');
-- SELECT refresh_materialized_view('public.mv_wallet_stats');

-- ============================================================================
-- QUERY OPTIMIZATION HINTS
-- ============================================================================

-- These comments serve as optimization guidelines for developers:

-- FAST ACCESS CHECK (for video players):
-- Use RPC function: SELECT * FROM has_active_rental_access(user_id, content_id, type)
-- This is faster than:
--   SELECT * FROM rental_access WHERE user_id = ? AND movie_id = ? AND expires_at > NOW()

-- BATCH PAYMENT PROCESSING:
-- Instead of N queries for N payments, use:
--   SELECT * FROM rental_intents 
--   WHERE status = 'pending' AND created_at > NOW() - INTERVAL '5 minutes'
--   ORDER BY created_at DESC

-- REFERRAL CODE VALIDATION:
-- Check is_active = true IN the WHERE clause to use partial index:
--   SELECT * FROM referral_codes WHERE code = ? AND is_active = true

-- WALLET DEBIT ATOMICITY:
-- Always use RPC: process_wallet_rental_payment() instead of manual updates
-- This ensures row locking and transaction atomicity

COMMIT;

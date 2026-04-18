-- ============================================================================
-- BACKFILL RENTAL PAYMENTS FROM EXISTING RECORDS
-- Run this in Supabase SQL Editor to migrate historical payment data
-- ============================================================================

-- ============================================================================
-- STEP 1: Backfill from all rentals
-- ============================================================================

INSERT INTO public.rental_payments (
  rental_id,
  user_id,
  amount,
  payment_status,
  payment_channel,
  metadata,
  created_at,
  completed_at
)
SELECT
  r.id,
  r.user_id,
  (r.amount)::BIGINT,
  CASE 
    WHEN r.status = 'active' THEN 'completed'::VARCHAR
    WHEN r.status = 'expired' THEN 'failed'::VARCHAR
    ELSE 'pending'::VARCHAR
  END as payment_status,
  'card' as payment_channel,
  jsonb_build_object(
    'original_rental_status', r.status,
    'content_type', r.content_type,
    'migrated', true
  )::JSONB as metadata,
  r.created_at,
  CASE WHEN r.status = 'active' THEN r.created_at ELSE NULL END
FROM public.rentals r
WHERE NOT EXISTS (
    SELECT 1 FROM public.rental_payments rp 
    WHERE rp.rental_id = r.id
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check how many payment records were created
SELECT COUNT(*) as total_rental_payments 
FROM public.rental_payments;

-- Check payment status distribution
SELECT payment_status, COUNT(*) 
FROM public.rental_payments 
GROUP BY payment_status;

-- Check payment channel distribution
SELECT payment_channel, COUNT(*) 
FROM public.rental_payments 
GROUP BY payment_channel;

-- View sample records
SELECT 
  rp.id,
  rp.rental_id,
  rp.payment_status,
  rp.payment_channel,
  rp.amount,
  rp.created_at,
  r.status as original_rental_status
FROM public.rental_payments rp
JOIN public.rentals r ON r.id = rp.rental_id
ORDER BY rp.created_at DESC
LIMIT 10;

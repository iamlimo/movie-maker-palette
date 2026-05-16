-- PHASE 7: LEGACY CLEANUP - Add write guards to prevent new writes to legacy rental tables
-- 
-- This migration adds database-level guards to prevent new writes (INSERT/UPDATE)
-- to the legacy `rentals` and `rental_payments` tables while allowing reads and deletes
-- for the deprecation window.
--
-- Purpose:
-- - Prevent accidental writes to legacy tables
-- - Ensure all new rentals use canonical rental_intents + rental_access
-- - Maintain backward compatibility for reads during transition period

-- Create trigger function to block new writes to rentals table
CREATE OR REPLACE FUNCTION public.block_new_rentals_writes()
RETURNS TRIGGER AS $$
BEGIN
  -- PHASE 7: Prevent new writes to legacy rentals table
  -- This ensures all rental writes go through rental_intents + rental_access
  RAISE EXCEPTION 'Writes to legacy rentals table are disabled. Use rental_intents + rental_access instead.';
END;
$$ LANGUAGE plpgsql;

-- Create trigger to block INSERT on rentals
DROP TRIGGER IF EXISTS prevent_rentals_insert ON public.rentals;
CREATE TRIGGER prevent_rentals_insert
BEFORE INSERT ON public.rentals
FOR EACH ROW
EXECUTE FUNCTION public.block_new_rentals_writes();

-- Create trigger to block UPDATE on rentals
DROP TRIGGER IF EXISTS prevent_rentals_update ON public.rentals;
CREATE TRIGGER prevent_rentals_update
BEFORE UPDATE ON public.rentals
FOR EACH ROW
EXECUTE FUNCTION public.block_new_rentals_writes();

-- Add comment explaining the guard
COMMENT ON TRIGGER prevent_rentals_insert ON public.rentals IS
  'PHASE 7 guard: Blocks new inserts to legacy rentals table. All new rentals must use rental_intents + rental_access.';
COMMENT ON TRIGGER prevent_rentals_update ON public.rentals IS
  'PHASE 7 guard: Blocks updates to legacy rentals table. All rental state changes must use rental_intents + rental_access.';

-- Create similar guard for rental_payments if it exists
DROP TRIGGER IF EXISTS prevent_rental_payments_insert ON public.rental_payments;
CREATE TRIGGER prevent_rental_payments_insert
BEFORE INSERT ON public.rental_payments
FOR EACH ROW
EXECUTE FUNCTION public.block_new_rentals_writes();

DROP TRIGGER IF EXISTS prevent_rental_payments_update ON public.rental_payments;
CREATE TRIGGER prevent_rental_payments_update
BEFORE UPDATE ON public.rental_payments
FOR EACH ROW
EXECUTE FUNCTION public.block_new_rentals_writes();

COMMENT ON TRIGGER prevent_rental_payments_insert ON public.rental_payments IS
  'PHASE 7 guard: Blocks new inserts to legacy rental_payments table. All payment records must use rental_intents table.';
COMMENT ON TRIGGER prevent_rental_payments_update ON public.rental_payments IS
  'PHASE 7 guard: Blocks updates to legacy rental_payments table.';

-- Document the deprecation plan
COMMENT ON TABLE public.rentals IS
  'DEPRECATED: Legacy table kept for backward compatibility reads only.
  All new writes are blocked as of 2026-05-16.
  All new rentals must use rental_intents + rental_access tables.
  This table will be dropped after 2026-06-16 (30-day deprecation window).';

COMMENT ON TABLE public.rental_payments IS
  'DEPRECATED: Legacy table kept for backward compatibility reads only.
  All new writes are blocked as of 2026-05-16.
  All payment records must use rental_intents + payments tables.
  This table will be dropped after 2026-06-16 (30-day deprecation window).';

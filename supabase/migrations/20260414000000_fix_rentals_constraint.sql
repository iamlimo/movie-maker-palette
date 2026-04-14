-- Fix rentals table content_type constraint to properly allow season/episode rentals
-- Error: check constraint "rentals_content_type_check" was rejecting valid content types

-- Drop the existing constraint if it exists
ALTER TABLE public.rentals
DROP CONSTRAINT IF EXISTS "rentals_content_type_check";

-- Add the corrected constraint (explicit about all valid types)
ALTER TABLE public.rentals
ADD CONSTRAINT "rentals_content_type_check" 
CHECK (content_type IN ('movie', 'tv', 'season', 'episode') AND content_type IS NOT NULL);

-- Verify the constraint is working
-- This query should succeed and show all rentals
-- SELECT COUNT(*) FROM public.rentals WHERE content_type IN ('movie', 'tv', 'season', 'episode');

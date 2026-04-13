-- Standardize content_type across all tables
-- This migration updates CHECK constraints to support: 'movie' | 'tv' | 'season' | 'episode'

-- 1. Update rentals table to support season and episode rentals
ALTER TABLE public.rentals
DROP CONSTRAINT "rentals_content_type_check";

ALTER TABLE public.rentals
ADD CONSTRAINT "rentals_content_type_check" 
CHECK (content_type IN ('movie', 'tv', 'season', 'episode'));

-- 2. Update watch_history table to support all content types
ALTER TABLE public.watch_history
DROP CONSTRAINT "watch_history_content_type_check";

ALTER TABLE public.watch_history
ADD CONSTRAINT "watch_history_content_type_check"
CHECK (content_type IN ('movie', 'episode', 'season', 'tv'));

-- 3. Update content_sections table to support all content types (but normalize tv_show to tv)
ALTER TABLE public.content_sections
DROP CONSTRAINT "content_sections_content_type_check";

ALTER TABLE public.content_sections
ADD CONSTRAINT "content_sections_content_type_check"
CHECK (content_type IN ('movie', 'tv', 'season', 'episode'));

-- 4. Create enum type for standardized content types (for future flexibility)
DO $$ BEGIN
  CREATE TYPE public.standardized_content_type AS ENUM ('movie', 'tv', 'season', 'episode');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 5. Add comment documenting the standard
COMMENT ON TABLE public.rentals IS 
'Standardized content_type values: movie (individual movies), tv (full tv shows), season (entire season), episode (individual episodes)';

COMMENT ON TABLE public.watch_history IS 
'Standardized content_type values: movie (individual movies), tv (full tv shows), season (entire season), episode (individual episodes)';

COMMENT ON TABLE public.content_sections IS 
'Standardized content_type values: movie (individual movies), tv (full tv shows), season (entire season), episode (individual episodes)';

-- 6. Create function to normalize frontend content types to database values
CREATE OR REPLACE FUNCTION public.normalize_content_type(input_type TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Normalize tv_show to tv
  IF input_type = 'tv_show' THEN
    RETURN 'tv';
  END IF;
  -- Return as-is if already valid
  IF input_type IN ('movie', 'tv', 'season', 'episode') THEN
    RETURN input_type;
  END IF;
  -- Default to 'tv' for unknown types
  RETURN 'tv';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment
COMMENT ON FUNCTION public.normalize_content_type IS 
'Normalizes all content types to database standard values. Maps tv_show -> tv, others remain unchanged.';

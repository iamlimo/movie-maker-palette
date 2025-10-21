-- Add new content safety and metadata columns to movies
ALTER TABLE public.movies 
  ADD COLUMN IF NOT EXISTS age_restriction integer,
  ADD COLUMN IF NOT EXISTS content_warnings text[],
  ADD COLUMN IF NOT EXISTS viewer_discretion text,
  ADD COLUMN IF NOT EXISTS cast_info text;

-- Add new content safety and metadata columns to tv_shows
ALTER TABLE public.tv_shows 
  ADD COLUMN IF NOT EXISTS age_restriction integer,
  ADD COLUMN IF NOT EXISTS content_warnings text[],
  ADD COLUMN IF NOT EXISTS viewer_discretion text,
  ADD COLUMN IF NOT EXISTS cast_info text;

-- Add helpful comments
COMMENT ON COLUMN public.movies.age_restriction IS 'Numeric age restriction (0, 13, 16, 18)';
COMMENT ON COLUMN public.movies.content_warnings IS 'Array of content warning tags';
COMMENT ON COLUMN public.movies.viewer_discretion IS 'Custom viewer discretion message';
COMMENT ON COLUMN public.movies.cast_info IS 'Cast information as free-form text';

COMMENT ON COLUMN public.tv_shows.age_restriction IS 'Numeric age restriction (0, 13, 16, 18)';
COMMENT ON COLUMN public.tv_shows.content_warnings IS 'Array of content warning tags';
COMMENT ON COLUMN public.tv_shows.viewer_discretion IS 'Custom viewer discretion message';
COMMENT ON COLUMN public.tv_shows.cast_info IS 'Cast information as free-form text';
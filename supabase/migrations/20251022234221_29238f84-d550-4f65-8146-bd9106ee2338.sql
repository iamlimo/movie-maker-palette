-- Add director and production company fields to movies and tv_shows
ALTER TABLE public.movies 
  ADD COLUMN IF NOT EXISTS director text,
  ADD COLUMN IF NOT EXISTS production_company text;

ALTER TABLE public.tv_shows 
  ADD COLUMN IF NOT EXISTS director text,
  ADD COLUMN IF NOT EXISTS production_company text;

COMMENT ON COLUMN public.movies.director IS 'Director name(s)';
COMMENT ON COLUMN public.movies.production_company IS 'Production company name';
COMMENT ON COLUMN public.tv_shows.director IS 'Director name(s)';
COMMENT ON COLUMN public.tv_shows.production_company IS 'Production company name';
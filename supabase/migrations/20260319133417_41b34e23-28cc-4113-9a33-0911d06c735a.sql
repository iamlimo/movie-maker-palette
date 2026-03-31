
-- Add slug column to movies
ALTER TABLE public.movies ADD COLUMN slug text;

-- Add slug column to tv_shows
ALTER TABLE public.tv_shows ADD COLUMN slug text;

-- Backfill slugs for movies
UPDATE public.movies 
SET slug = lower(regexp_replace(trim(title), '[^a-zA-Z0-9]+', '-', 'g'));

-- Handle duplicate slugs in movies by appending short id suffix
UPDATE public.movies m1
SET slug = m1.slug || '-' || left(m1.id::text, 4)
WHERE EXISTS (
  SELECT 1 FROM public.movies m2 
  WHERE m2.slug = m1.slug AND m2.id != m1.id AND m2.created_at < m1.created_at
);

-- Backfill slugs for tv_shows
UPDATE public.tv_shows 
SET slug = lower(regexp_replace(trim(title), '[^a-zA-Z0-9]+', '-', 'g'));

-- Handle duplicate slugs in tv_shows by appending short id suffix
UPDATE public.tv_shows t1
SET slug = t1.slug || '-' || left(t1.id::text, 4)
WHERE EXISTS (
  SELECT 1 FROM public.tv_shows t2 
  WHERE t2.slug = t1.slug AND t2.id != t1.id AND t2.created_at < t1.created_at
);

-- Now make slug NOT NULL and UNIQUE
ALTER TABLE public.movies ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.movies ADD CONSTRAINT movies_slug_unique UNIQUE (slug);

ALTER TABLE public.tv_shows ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.tv_shows ADD CONSTRAINT tv_shows_slug_unique UNIQUE (slug);

-- Create indexes for fast lookups
CREATE INDEX idx_movies_slug ON public.movies (slug);
CREATE INDEX idx_tv_shows_slug ON public.tv_shows (slug);

-- Add rental_expiry_duration field to movies table
ALTER TABLE public.movies 
ADD COLUMN rental_expiry_duration INTEGER DEFAULT 48;

-- Add comment for clarity
COMMENT ON COLUMN public.movies.rental_expiry_duration IS 'Rental duration in hours, default 48 hours';

-- Update existing movies to have default rental expiry
UPDATE public.movies 
SET rental_expiry_duration = 48 
WHERE rental_expiry_duration IS NULL;
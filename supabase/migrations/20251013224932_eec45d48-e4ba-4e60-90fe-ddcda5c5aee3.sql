-- Update default prices to kobo (100 kobo = 1 Naira)
-- Movies: Default ₦1,000 = 100,000 kobo
-- Seasons: Default ₦3,000 = 300,000 kobo  
-- Episodes: Default ₦350 = 35,000 kobo

ALTER TABLE movies 
  ALTER COLUMN price SET DEFAULT 100000;

ALTER TABLE seasons 
  ALTER COLUMN price SET DEFAULT 300000;

ALTER TABLE episodes 
  ALTER COLUMN price SET DEFAULT 35000;

-- Add helpful comments for documentation
COMMENT ON COLUMN movies.price IS 'Price in kobo (100 kobo = 1 Naira). Default: 100000 kobo (₦1,000)';
COMMENT ON COLUMN seasons.price IS 'Price in kobo (100 kobo = 1 Naira). Default: 300000 kobo (₦3,000)';
COMMENT ON COLUMN episodes.price IS 'Price in kobo (100 kobo = 1 Naira). Default: 35000 kobo (₦350)';
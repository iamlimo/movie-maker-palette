-- Update rentals table content_type constraint to support episode and season
-- This aligns the database schema with the process-rental function

ALTER TABLE rentals DROP CONSTRAINT rentals_content_type_check;

ALTER TABLE rentals ADD CONSTRAINT rentals_content_type_check 
  CHECK (content_type IN ('movie', 'tv', 'episode', 'season'));

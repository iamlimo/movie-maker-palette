-- Add promotion and coming soon features to slider_items
-- Create enum for promotion types
CREATE TYPE promotion_type AS ENUM ('standard', 'promoted', 'coming_soon');

-- Add new columns to slider_items
ALTER TABLE slider_items
ADD COLUMN promotion_type promotion_type NOT NULL DEFAULT 'standard',
ADD COLUMN release_date timestamp with time zone,
ADD COLUMN promotion_badge_text text,
ADD COLUMN promotion_priority integer NOT NULL DEFAULT 0,
ADD COLUMN promotion_starts_at timestamp with time zone,
ADD COLUMN promotion_ends_at timestamp with time zone;

-- Create index for efficient filtering
CREATE INDEX idx_slider_items_promotion_type ON slider_items(promotion_type);
CREATE INDEX idx_slider_items_priority ON slider_items(promotion_priority DESC);
CREATE INDEX idx_slider_items_release_date ON slider_items(release_date);

-- Add check constraint to ensure coming_soon items have release_date
ALTER TABLE slider_items
ADD CONSTRAINT check_coming_soon_release_date 
CHECK (promotion_type != 'coming_soon' OR release_date IS NOT NULL);

COMMENT ON COLUMN slider_items.promotion_type IS 'Type of promotion: standard, promoted, or coming_soon';
COMMENT ON COLUMN slider_items.release_date IS 'Release date for coming soon content';
COMMENT ON COLUMN slider_items.promotion_badge_text IS 'Custom badge text for promoted items';
COMMENT ON COLUMN slider_items.promotion_priority IS 'Higher priority items appear first (0-100)';
COMMENT ON COLUMN slider_items.promotion_starts_at IS 'When the promotion becomes active';
COMMENT ON COLUMN slider_items.promotion_ends_at IS 'When the promotion ends';
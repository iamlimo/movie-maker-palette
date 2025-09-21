-- Add cover_image field to seasons table
ALTER TABLE public.seasons ADD COLUMN cover_image_url TEXT;

-- Add status field to seasons and episodes for publishing workflow
ALTER TABLE public.seasons ADD COLUMN status content_status NOT NULL DEFAULT 'pending';
ALTER TABLE public.episodes ADD COLUMN published_at TIMESTAMP WITH TIME ZONE;

-- Update content_type enum to include 'season' for pricing
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'season';

-- Create index for better performance on episode queries
CREATE INDEX IF NOT EXISTS idx_episodes_season_status ON public.episodes(season_id, status);
CREATE INDEX IF NOT EXISTS idx_seasons_show_status ON public.seasons(tv_show_id, status);

-- Add function to get total episodes in a season
CREATE OR REPLACE FUNCTION public.get_season_episode_count(season_id_param UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.episodes
  WHERE season_id = season_id_param
    AND status = 'approved';
$$;
-- Add trailer_url column to episodes table if it doesn't exist
DO $$ 
BEGIN
    -- Check if trailer_url column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'episodes' 
        AND column_name = 'trailer_url'
        AND table_schema = 'public'
    ) THEN
        -- Add trailer_url column
        ALTER TABLE public.episodes 
        ADD COLUMN trailer_url TEXT;
        
        -- Add comment to document the column
        COMMENT ON COLUMN public.episodes.trailer_url IS 'URL to the episode trailer video file';
    END IF;
END $$;
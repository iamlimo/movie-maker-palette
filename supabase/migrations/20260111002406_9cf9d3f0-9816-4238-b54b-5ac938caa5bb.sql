-- Add playback_position column to store exact seconds watched
ALTER TABLE watch_history 
ADD COLUMN IF NOT EXISTS playback_position INTEGER DEFAULT 0;

-- Add video_duration column for calculating progress
ALTER TABLE watch_history 
ADD COLUMN IF NOT EXISTS video_duration INTEGER DEFAULT 0;

-- Add index for faster queries on user content lookups
CREATE INDEX IF NOT EXISTS idx_watch_history_user_content 
ON watch_history(user_id, content_type, content_id);
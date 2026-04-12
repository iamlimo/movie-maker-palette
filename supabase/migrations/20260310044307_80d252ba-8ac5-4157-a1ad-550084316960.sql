-- Add subtitle_url column to movies and episodes
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS subtitle_url text;
ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS subtitle_url text;

-- Create subtitles storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('subtitles', 'subtitles', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for subtitles bucket
CREATE POLICY "Anyone can view subtitles"
ON storage.objects FOR SELECT
USING (bucket_id = 'subtitles');

CREATE POLICY "Super admins can manage subtitles"
ON storage.objects FOR ALL
USING (bucket_id = 'subtitles' AND public.has_role(auth.uid(), 'super_admin'::public.app_role));
-- Add enhanced storage buckets for content management
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  ('landscape-posters', 'landscape-posters', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('slider-covers', 'slider-covers', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Add new content schema fields for enhanced media support
ALTER TABLE movies 
ADD COLUMN IF NOT EXISTS landscape_poster_url TEXT,
ADD COLUMN IF NOT EXISTS slider_cover_url TEXT,
ADD COLUMN IF NOT EXISTS optimization_metadata JSONB DEFAULT '{}';

ALTER TABLE tv_shows 
ADD COLUMN IF NOT EXISTS landscape_poster_url TEXT,
ADD COLUMN IF NOT EXISTS slider_cover_url TEXT,
ADD COLUMN IF NOT EXISTS optimization_metadata JSONB DEFAULT '{}';

-- Create RLS policies for new buckets
CREATE POLICY "Anyone can view landscape posters" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'landscape-posters');

CREATE POLICY "Super admins can upload landscape posters" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'landscape-posters' AND has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update landscape posters" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'landscape-posters' AND has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete landscape posters" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'landscape-posters' AND has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Anyone can view slider covers" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'slider-covers');

CREATE POLICY "Super admins can upload slider covers" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'slider-covers' AND has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update slider covers" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'slider-covers' AND has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete slider covers" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'slider-covers' AND has_role(auth.uid(), 'super_admin'));
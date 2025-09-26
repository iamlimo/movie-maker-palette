-- Clean up redundant views and create missing storage buckets
-- Remove duplicate view
DROP VIEW IF EXISTS movie_details CASCADE;

-- Create missing storage buckets for unified media management
INSERT INTO storage.buckets (id, name, public) VALUES 
('videos', 'videos', false),
('thumbnails', 'thumbnails', true),
('trailers', 'trailers', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for videos bucket
CREATE POLICY "Videos are viewable by authenticated users" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'videos' AND auth.role() = 'authenticated');

CREATE POLICY "Super admins can upload videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'videos' AND has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update videos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'videos' AND has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete videos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'videos' AND has_role(auth.uid(), 'super_admin'));

-- Create storage policies for thumbnails bucket
CREATE POLICY "Thumbnails are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'thumbnails');

CREATE POLICY "Super admins can manage thumbnails" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'thumbnails' AND has_role(auth.uid(), 'super_admin'));

-- Create storage policies for trailers bucket
CREATE POLICY "Trailers are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'trailers');

CREATE POLICY "Super admins can manage trailers" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'trailers' AND has_role(auth.uid(), 'super_admin'));
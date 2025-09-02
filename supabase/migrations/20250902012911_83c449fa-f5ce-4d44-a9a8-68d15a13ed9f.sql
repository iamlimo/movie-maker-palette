-- Create storage bucket for videos and thumbnails
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('videos', 'videos', false, 1073741824, ARRAY['video/mp4', 'video/webm', 'video/ogg', 'application/vnd.apple.mpegurl']),
  ('thumbnails', 'thumbnails', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- RLS policies for videos bucket
CREATE POLICY "Super admins can manage videos" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'videos' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated users can view videos they have access to" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'videos' AND 
  auth.uid() IS NOT NULL AND
  (
    -- Super admins can see all
    has_role(auth.uid(), 'super_admin'::app_role) OR
    -- Users can see videos they purchased or rented
    EXISTS (
      SELECT 1 FROM purchases p 
      JOIN movies m ON m.id = p.content_id::uuid 
      WHERE p.user_id = auth.uid() 
      AND p.content_type = 'movie'
      AND m.video_url = storage.objects.name
    ) OR
    EXISTS (
      SELECT 1 FROM rentals r 
      JOIN movies m ON m.id = r.content_id::uuid 
      WHERE r.user_id = auth.uid() 
      AND r.content_type = 'movie'
      AND r.status = 'active'
      AND r.expiration_date > now()
      AND m.video_url = storage.objects.name
    )
  )
);

-- RLS policies for thumbnails bucket
CREATE POLICY "Super admins can manage thumbnails" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'thumbnails' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Anyone can view thumbnails" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'thumbnails');
-- Create tv-trailers bucket if it doesn't exist (check first)
INSERT INTO storage.buckets (id, name, public)
SELECT 'tv-trailers', 'tv-trailers', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'tv-trailers'
);

-- Create RLS policies for tv-trailers bucket
CREATE POLICY "Anyone can view tv trailers" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'tv-trailers');

CREATE POLICY "Super admins can upload tv trailers" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'tv-trailers' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update tv trailers" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'tv-trailers' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete tv trailers" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'tv-trailers' AND has_role(auth.uid(), 'super_admin'::app_role));
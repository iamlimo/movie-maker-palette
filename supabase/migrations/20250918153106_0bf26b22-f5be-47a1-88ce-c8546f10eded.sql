-- Create new user_payments table for payment gating
CREATE TABLE public.user_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  access_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_payments
ALTER TABLE public.user_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for user_payments
CREATE POLICY "Users can view their own payments" 
ON public.user_payments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payments" 
ON public.user_payments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all payments" 
ON public.user_payments 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Update tv_shows table to include trailer_url and improve genres
ALTER TABLE public.tv_shows 
ADD COLUMN IF NOT EXISTS trailer_url TEXT,
ADD COLUMN IF NOT EXISTS genres TEXT[] DEFAULT '{}';

-- Update episodes table to include thumbnail_url and improve structure
ALTER TABLE public.episodes 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create storage buckets for TV show content
INSERT INTO storage.buckets (id, name, public) VALUES 
('tv-show-posters', 'tv-show-posters', true),
('tv-trailers', 'tv-trailers', true),
('tv-episodes', 'tv-episodes', false),
('episode-thumbnails', 'episode-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for TV show posters (public)
CREATE POLICY "Anyone can view TV show posters" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'tv-show-posters');

CREATE POLICY "Super admins can upload TV show posters" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'tv-show-posters' AND has_role(auth.uid(), 'super_admin'::app_role));

-- Create storage policies for TV trailers (public)
CREATE POLICY "Anyone can view TV trailers" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'tv-trailers');

CREATE POLICY "Super admins can upload TV trailers" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'tv-trailers' AND has_role(auth.uid(), 'super_admin'::app_role));

-- Create storage policies for TV episodes (private - payment gated)
CREATE POLICY "Users with valid payments can view episodes" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'tv-episodes' AND 
  EXISTS (
    SELECT 1 FROM public.user_payments 
    WHERE user_id = auth.uid() 
    AND payment_status = 'success' 
    AND access_expires_at > now()
  )
);

CREATE POLICY "Super admins can manage TV episodes" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'tv-episodes' AND has_role(auth.uid(), 'super_admin'::app_role));

-- Create storage policies for episode thumbnails (public)
CREATE POLICY "Anyone can view episode thumbnails" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'episode-thumbnails');

CREATE POLICY "Super admins can upload episode thumbnails" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'episode-thumbnails' AND has_role(auth.uid(), 'super_admin'::app_role));

-- Create trigger for user_payments updated_at
CREATE TRIGGER update_user_payments_updated_at
BEFORE UPDATE ON public.user_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
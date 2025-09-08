-- Create slider_items table for hero slider content
CREATE TABLE public.slider_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  poster_url TEXT,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'tv_show')),
  content_id UUID NOT NULL,
  genre TEXT,
  rating TEXT,
  price NUMERIC NOT NULL DEFAULT 0.00,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_rentable BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.slider_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view active slider items" 
ON public.slider_items 
FOR SELECT 
USING (status = 'active');

CREATE POLICY "Super admins can manage slider items" 
ON public.slider_items 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_slider_items_updated_at
BEFORE UPDATE ON public.slider_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample slider items using existing movies
INSERT INTO public.slider_items (title, description, poster_url, content_type, content_id, genre, rating, price, is_featured, is_rentable, sort_order) 
SELECT 
  title,
  description,
  thumbnail_url,
  'movie',
  id,
  'Sci-Fi',
  rating,
  price,
  true,
  true,
  ROW_NUMBER() OVER (ORDER BY created_at DESC)
FROM public.movies 
WHERE status = 'approved' AND thumbnail_url IS NOT NULL
LIMIT 5;
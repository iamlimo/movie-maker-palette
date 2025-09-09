-- Create sections table for homepage content organization
CREATE TABLE public.sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create content_sections junction table for many-to-many relationship
CREATE TABLE public.content_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'tv_show')),
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(content_id, content_type, section_id)
);

-- Create banners table for promotional content
CREATE TABLE public.banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  cta_text TEXT,
  cta_link TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sections
CREATE POLICY "Anyone can view visible sections" 
ON public.sections 
FOR SELECT 
USING (is_visible = true);

CREATE POLICY "Super admins can manage sections" 
ON public.sections 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies for content_sections
CREATE POLICY "Anyone can view content section assignments" 
ON public.content_sections 
FOR SELECT 
USING (true);

CREATE POLICY "Super admins can manage content sections" 
ON public.content_sections 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies for banners
CREATE POLICY "Anyone can view visible banners" 
ON public.banners 
FOR SELECT 
USING (is_visible = true);

CREATE POLICY "Super admins can manage banners" 
ON public.banners 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_sections_display_order ON public.sections(display_order);
CREATE INDEX idx_sections_visible ON public.sections(is_visible);
CREATE INDEX idx_content_sections_section_id ON public.content_sections(section_id);
CREATE INDEX idx_content_sections_content ON public.content_sections(content_id, content_type);
CREATE INDEX idx_content_sections_display_order ON public.content_sections(display_order);
CREATE INDEX idx_banners_display_order ON public.banners(display_order);
CREATE INDEX idx_banners_visible ON public.banners(is_visible);

-- Add triggers for updated_at columns
CREATE TRIGGER update_sections_updated_at
BEFORE UPDATE ON public.sections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_banners_updated_at
BEFORE UPDATE ON public.banners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
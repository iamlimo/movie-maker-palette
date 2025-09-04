-- Phase 1: Create Cast & Crew System
CREATE TABLE public.cast_crew (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL, -- e.g., 'actor', 'director', 'producer', 'writer', etc.
    bio TEXT,
    photo_url TEXT,
    social_links JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for cast_crew
ALTER TABLE public.cast_crew ENABLE ROW LEVEL SECURITY;

-- Cast & crew policies
CREATE POLICY "Anyone can view cast and crew"
ON public.cast_crew
FOR SELECT
USING (true);

CREATE POLICY "Super admins can manage cast and crew"
ON public.cast_crew
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Movie cast join table
CREATE TABLE public.movie_cast (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    movie_id UUID NOT NULL,
    cast_crew_id UUID NOT NULL,
    role_type TEXT NOT NULL, -- e.g., 'main_cast', 'supporting_cast', 'director', 'producer'
    character_name TEXT, -- for actors
    credit_order INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(movie_id, cast_crew_id, role_type)
);

-- Enable RLS for movie_cast
ALTER TABLE public.movie_cast ENABLE ROW LEVEL SECURITY;

-- Movie cast policies
CREATE POLICY "Anyone can view movie cast"
ON public.movie_cast
FOR SELECT
USING (true);

CREATE POLICY "Super admins can manage movie cast"
ON public.movie_cast
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- TV show cast join table
CREATE TABLE public.tv_show_cast (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tv_show_id UUID NOT NULL,
    cast_crew_id UUID NOT NULL,
    role_type TEXT NOT NULL,
    character_name TEXT,
    credit_order INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(tv_show_id, cast_crew_id, role_type)
);

-- Enable RLS for tv_show_cast
ALTER TABLE public.tv_show_cast ENABLE ROW LEVEL SECURITY;

-- TV show cast policies
CREATE POLICY "Anyone can view tv show cast"
ON public.tv_show_cast
FOR SELECT
USING (true);

CREATE POLICY "Super admins can manage tv show cast"
ON public.tv_show_cast
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Episode cast join table (for guest stars)
CREATE TABLE public.episode_cast (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    episode_id UUID NOT NULL,
    cast_crew_id UUID NOT NULL,
    role_type TEXT NOT NULL,
    character_name TEXT,
    credit_order INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(episode_id, cast_crew_id, role_type)
);

-- Enable RLS for episode_cast
ALTER TABLE public.episode_cast ENABLE ROW LEVEL SECURITY;

-- Episode cast policies
CREATE POLICY "Anyone can view episode cast"
ON public.episode_cast
FOR SELECT
USING (true);

CREATE POLICY "Super admins can manage episode cast"
ON public.episode_cast
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Add trailer_url to movies table
ALTER TABLE public.movies ADD COLUMN trailer_url TEXT;

-- Add pricing and rental settings to seasons
ALTER TABLE public.seasons ADD COLUMN price NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.seasons ADD COLUMN rental_expiry_duration INTEGER NOT NULL DEFAULT 336; -- 14 days in hours

-- Add pricing and rental settings to episodes
ALTER TABLE public.episodes ADD COLUMN rental_expiry_duration INTEGER NOT NULL DEFAULT 48; -- 48 hours default

-- Create indexes for better performance
CREATE INDEX idx_movie_cast_movie_id ON public.movie_cast(movie_id);
CREATE INDEX idx_movie_cast_cast_crew_id ON public.movie_cast(cast_crew_id);
CREATE INDEX idx_tv_show_cast_tv_show_id ON public.tv_show_cast(tv_show_id);
CREATE INDEX idx_episode_cast_episode_id ON public.episode_cast(episode_id);
CREATE INDEX idx_cast_crew_role ON public.cast_crew(role);

-- Add updated_at triggers
CREATE TRIGGER update_cast_crew_updated_at
    BEFORE UPDATE ON public.cast_crew
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create a view for movie details with cast
CREATE OR REPLACE VIEW public.movie_details AS
SELECT 
    m.*,
    g.name as genre_name,
    COALESCE(
        json_agg(
            json_build_object(
                'id', mc.id,
                'cast_crew_id', cc.id,
                'name', cc.name,
                'role', cc.role,
                'role_type', mc.role_type,
                'character_name', mc.character_name,
                'credit_order', mc.credit_order,
                'photo_url', cc.photo_url
            ) ORDER BY mc.credit_order, cc.name
        ) FILTER (WHERE cc.id IS NOT NULL),
        '[]'::json
    ) as cast_crew
FROM public.movies m
LEFT JOIN public.genres g ON m.genre_id = g.id
LEFT JOIN public.movie_cast mc ON m.id = mc.movie_id
LEFT JOIN public.cast_crew cc ON mc.cast_crew_id = cc.id
GROUP BY m.id, g.name;
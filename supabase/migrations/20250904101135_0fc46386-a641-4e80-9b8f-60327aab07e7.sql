-- Fix security issue: Remove SECURITY DEFINER from view and recreate with proper permissions
DROP VIEW IF EXISTS public.movie_details;

-- Create view without SECURITY DEFINER (uses invoker's permissions)
CREATE VIEW public.movie_details AS
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
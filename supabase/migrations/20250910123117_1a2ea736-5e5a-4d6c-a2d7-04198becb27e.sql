-- Fix Security Definer View issue by recreating movie_details view as SECURITY INVOKER
-- This ensures RLS policies are properly enforced for querying users

-- Drop the existing view
DROP VIEW IF EXISTS public.movie_details;

-- Recreate the view without SECURITY DEFINER (defaults to SECURITY INVOKER)
CREATE VIEW public.movie_details 
WITH (security_invoker = true) AS
SELECT 
    m.id,
    m.title,
    m.description,
    m.duration,
    m.release_date,
    m.price,
    m.genre_id,
    g.name AS genre_name,
    m.trailer_url,
    m.thumbnail_url,
    m.video_url,
    m.language,
    m.rating,
    m.status,
    m.uploaded_by,
    m.rental_expiry_duration,
    m.created_at,
    m.updated_at,
    COALESCE(
        (
            SELECT json_agg(
                json_build_object(
                    'id', cc.id,
                    'name', cc.name,
                    'role', mc.role_type,
                    'character_name', mc.character_name,
                    'credit_order', mc.credit_order,
                    'photo_url', cc.photo_url,
                    'bio', cc.bio
                ) ORDER BY mc.credit_order
            )
            FROM movie_cast mc
            JOIN cast_crew cc ON mc.cast_crew_id = cc.id
            WHERE mc.movie_id = m.id
        ), 
        '[]'::json
    ) AS cast_crew
FROM movies m
LEFT JOIN genres g ON m.genre_id = g.id;

-- Grant appropriate permissions
GRANT SELECT ON public.movie_details TO authenticated, anon;
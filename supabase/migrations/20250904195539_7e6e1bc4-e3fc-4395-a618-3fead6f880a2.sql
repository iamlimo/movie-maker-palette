-- Fix security definer view issue by recreating movie_details view without SECURITY DEFINER
DROP VIEW IF EXISTS public.movie_details;

-- Recreate the view with proper permissions (without SECURITY DEFINER)
CREATE VIEW public.movie_details AS
SELECT 
    m.id,
    m.title,
    m.description,
    m.duration,
    m.release_date,
    m.price,
    m.genre_id,
    g.name as genre_name,
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
    -- Cast and crew information as JSON
    COALESCE(
        (SELECT json_agg(
            json_build_object(
                'id', cc.id,
                'name', cc.name,
                'role', mc.role_type,
                'character_name', mc.character_name,
                'credit_order', mc.credit_order,
                'photo_url', cc.photo_url,
                'bio', cc.bio
            ) ORDER BY mc.credit_order ASC
        )
        FROM movie_cast mc
        JOIN cast_crew cc ON mc.cast_crew_id = cc.id
        WHERE mc.movie_id = m.id),
        '[]'::json
    ) as cast_crew
FROM movies m
LEFT JOIN genres g ON m.genre_id = g.id;
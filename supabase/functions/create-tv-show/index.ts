import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { corsHeaders } from "../_shared/cors.ts";
import { authenticateUser } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, supabase } = await authenticateUser(req);
    
    // Check if user is super admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    
    if (userRole?.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const genres = JSON.parse(formData.get('genres') as string || '[]');
    const genreId = formData.get('genre_id') as string;
    const releaseDate = formData.get('release_date') as string;
    const language = formData.get('language') as string;
    const rating = formData.get('rating') as string;
    const price = parseFloat(formData.get('price') as string || '0');
    const posterFile = formData.get('poster') as File;
    const trailerFile = formData.get('trailer') as File;

    if (!title || !posterFile) {
      return new Response(
        JSON.stringify({ error: 'Title and poster are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let posterUrl = '';
    let trailerUrl = '';

    // Upload poster to tv-show-posters bucket
    const posterFileName = `${crypto.randomUUID()}-${posterFile.name}`;
    const { data: posterData, error: posterError } = await supabase.storage
      .from('tv-show-posters')
      .upload(posterFileName, posterFile);

    if (posterError) {
      console.error('Poster upload error:', posterError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload poster' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    posterUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/tv-show-posters/${posterData.path}`;

    // Upload trailer if provided
    if (trailerFile && trailerFile.size > 0) {
      const trailerFileName = `${crypto.randomUUID()}-${trailerFile.name}`;
      const { data: trailerData, error: trailerError } = await supabase.storage
        .from('tv-trailers')
        .upload(trailerFileName, trailerFile);

      if (trailerError) {
        console.error('Trailer upload error:', trailerError);
        // Continue without trailer, don't fail the entire operation
      } else {
        trailerUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/tv-trailers/${trailerData.path}`;
      }
    }

    // Create TV show record
    const { data: tvShow, error: tvShowError } = await supabase
      .from('tv_shows')
      .insert({
        title,
        description,
        genres,
        genre_id: genreId || null,
        release_date: releaseDate || null,
        language,
        rating,
        price,
        thumbnail_url: posterUrl,
        landscape_poster_url: posterUrl,
        slider_cover_url: posterUrl,
        trailer_url: trailerUrl || null,
        uploaded_by: user.id,
        status: 'approved'
      })
      .select()
      .single();

    if (tvShowError) {
      console.error('TV show creation error:', tvShowError);
      return new Response(
        JSON.stringify({ error: 'Failed to create TV show' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        tvShow,
        message: 'TV show created successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-tv-show:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
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
    const seasonId = formData.get('season_id') as string;
    const episodeNumber = parseInt(formData.get('episode_number') as string);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const duration = parseInt(formData.get('duration') as string || '0');
    const price = parseFloat(formData.get('price') as string || '0');
    const videoFile = formData.get('video') as File;
    const thumbnailFile = formData.get('thumbnail') as File;

    if (!seasonId || !episodeNumber || !title || !videoFile || !thumbnailFile) {
      return new Response(
        JSON.stringify({ error: 'Season ID, episode number, title, video, and thumbnail are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify season exists
    const { data: season, error: seasonError } = await supabase
      .from('seasons')
      .select('id')
      .eq('id', seasonId)
      .single();

    if (seasonError || !season) {
      return new Response(
        JSON.stringify({ error: 'Season not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if episode already exists
    const { data: existingEpisode } = await supabase
      .from('episodes')
      .select('id')
      .eq('season_id', seasonId)
      .eq('episode_number', episodeNumber)
      .single();

    if (existingEpisode) {
      return new Response(
        JSON.stringify({ error: 'Episode number already exists for this season' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let videoUrl = '';
    let thumbnailUrl = '';

    // Upload video to tv-episodes bucket (private)
    const videoFileName = `${crypto.randomUUID()}-${videoFile.name}`;
    const { data: videoData, error: videoError } = await supabase.storage
      .from('tv-episodes')
      .upload(videoFileName, videoFile);

    if (videoError) {
      console.error('Video upload error:', videoError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload video' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    videoUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/tv-episodes/${videoData.path}`;

    // Upload thumbnail to episode-thumbnails bucket (public)
    const thumbnailFileName = `${crypto.randomUUID()}-${thumbnailFile.name}`;
    const { data: thumbnailData, error: thumbnailError } = await supabase.storage
      .from('episode-thumbnails')
      .upload(thumbnailFileName, thumbnailFile);

    if (thumbnailError) {
      console.error('Thumbnail upload error:', thumbnailError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload thumbnail' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    thumbnailUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/episode-thumbnails/${thumbnailData.path}`;

    // Create episode record
    const { data: episode, error: episodeError } = await supabase
      .from('episodes')
      .insert({
        season_id: seasonId,
        episode_number: episodeNumber,
        title,
        description: description || null,
        duration: duration || null,
        price: price || 0,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        status: 'approved'
      })
      .select()
      .single();

    if (episodeError) {
      console.error('Episode creation error:', episodeError);
      return new Response(
        JSON.stringify({ error: 'Failed to create episode' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        episode,
        message: 'Episode uploaded successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in upload-episode:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
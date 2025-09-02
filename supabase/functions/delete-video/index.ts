import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify authentication and super admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if user is super admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Super admin access required' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const { movieId } = await req.json();

    if (!movieId) {
      return new Response(
        JSON.stringify({ error: 'Movie ID is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get movie details to find file paths
    const { data: movie, error: movieError } = await supabase
      .from('movies')
      .select('video_url, thumbnail_url')
      .eq('id', movieId)
      .single();

    if (movieError || !movie) {
      return new Response(
        JSON.stringify({ error: 'Movie not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const deletedFiles = [];
    const errors = [];

    // Delete video file if it exists
    if (movie.video_url) {
      const { error: videoDeleteError } = await supabase.storage
        .from('videos')
        .remove([movie.video_url]);

      if (videoDeleteError) {
        console.error('Video deletion error:', videoDeleteError);
        errors.push(`Failed to delete video: ${videoDeleteError.message}`);
      } else {
        deletedFiles.push(`video: ${movie.video_url}`);
      }
    }

    // Delete thumbnail file if it exists
    if (movie.thumbnail_url) {
      const { error: thumbnailDeleteError } = await supabase.storage
        .from('thumbnails')
        .remove([movie.thumbnail_url]);

      if (thumbnailDeleteError) {
        console.error('Thumbnail deletion error:', thumbnailDeleteError);
        errors.push(`Failed to delete thumbnail: ${thumbnailDeleteError.message}`);
      } else {
        deletedFiles.push(`thumbnail: ${movie.thumbnail_url}`);
      }
    }

    // Update movie record to remove file URLs
    const { error: updateError } = await supabase
      .from('movies')
      .update({
        video_url: null,
        thumbnail_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', movieId);

    if (updateError) {
      console.error('Movie update error:', updateError);
      errors.push(`Failed to update movie record: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        deletedFiles: deletedFiles,
        errors: errors,
        message: errors.length === 0 
          ? 'Files deleted successfully' 
          : 'Some files could not be deleted'
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Delete video function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
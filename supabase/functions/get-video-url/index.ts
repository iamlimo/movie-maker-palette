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

    // Verify authentication
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

    const { movieId, expiryHours = 24 } = await req.json();

    if (!movieId) {
      return new Response(
        JSON.stringify({ error: 'Movie ID is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get movie details
    const { data: movie, error: movieError } = await supabase
      .from('movies')
      .select('id, video_url, status, price')
      .eq('id', movieId)
      .single();

    if (movieError || !movie) {
      return new Response(
        JSON.stringify({ error: 'Movie not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (movie.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Movie not available' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Check user access - super admin has full access
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isSuperAdmin = roleData?.role === 'super_admin';

    if (!isSuperAdmin) {
      // Check if user has purchased the movie
      const { data: purchase } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('content_id', movieId)
        .eq('content_type', 'movie')
        .single();

      // Check if user has active rental
      const { data: rental } = await supabase
        .from('rentals')
        .select('id, expiration_date')
        .eq('user_id', user.id)
        .eq('content_id', movieId)
        .eq('content_type', 'movie')
        .eq('status', 'active')
        .gt('expiration_date', new Date().toISOString())
        .single();

      if (!purchase && !rental) {
        return new Response(
          JSON.stringify({ error: 'Access denied. Purchase or rent this movie to watch.' }),
          { status: 403, headers: corsHeaders }
        );
      }
    }

    if (!movie.video_url) {
      return new Response(
        JSON.stringify({ error: 'Video file not available' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Create signed URL for video access
    const expiresIn = expiryHours * 3600; // Convert hours to seconds
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('videos')
      .createSignedUrl(movie.video_url, expiresIn);

    if (signedUrlError) {
      console.error('Signed URL creation error:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate video URL' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();

    return new Response(
      JSON.stringify({
        success: true,
        signedUrl: signedUrlData.signedUrl,
        expiresAt: expiresAt,
        message: 'Video URL generated successfully'
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Get video URL function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BACKBLAZE_API_URL = 'https://api.backblazeb2.com';

interface B2AuthResponse {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
}

interface B2SignedUrlResponse {
  authorizationToken: string;
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

    const videoUrl = movie.video_url;

    // Check if it's a Backblaze URL
    const isBackblazeUrl = videoUrl.includes('backblazeb2.com') || 
                           videoUrl.includes('b2cdn.com') ||
                           (!videoUrl.startsWith('http') && videoUrl.includes('/'));

    if (isBackblazeUrl) {
      // Generate Backblaze signed URL
      const b2KeyId = Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY_ID');
      const b2AppKey = Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY');
      const b2BucketName = Deno.env.get('BACKBLAZE_B2_BUCKET_NAME');

      if (!b2KeyId || !b2AppKey || !b2BucketName) {
        return new Response(
          JSON.stringify({ error: 'Backblaze credentials not configured' }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Extract file path (remove domain if present)
      let filePath = videoUrl;
      if (videoUrl.includes('://')) {
        try {
          const urlObj = new URL(videoUrl);
          filePath = urlObj.pathname.split('/').filter(p => p).slice(1).join('/');
        } catch {
          filePath = videoUrl;
        }
      }

      // Authorize with Backblaze B2
      const authResponse = await fetch(`${BACKBLAZE_API_URL}/b2api/v2/b2_authorize_account`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${b2KeyId}:${b2AppKey}`)}`
        }
      });

      if (!authResponse.ok) {
        console.error('Backblaze authorization failed');
        return new Response(
          JSON.stringify({ error: 'Failed to authorize with Backblaze' }),
          { status: 500, headers: corsHeaders }
        );
      }

      const authData: B2AuthResponse = await authResponse.json();

      // Generate download authorization (2 hour expiry)
      const validDurationInSeconds = 7200;
      const downloadAuthResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_download_authorization`, {
        method: 'POST',
        headers: {
          'Authorization': authData.authorizationToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bucketId: b2BucketName,
          fileNamePrefix: filePath,
          validDurationInSeconds
        })
      });

      if (!downloadAuthResponse.ok) {
        console.error('Backblaze download authorization failed');
        return new Response(
          JSON.stringify({ error: 'Failed to generate download authorization' }),
          { status: 500, headers: corsHeaders }
        );
      }

      const downloadAuthData: B2SignedUrlResponse = await downloadAuthResponse.json();
      const signedUrl = `${authData.downloadUrl}/file/${b2BucketName}/${filePath}?Authorization=${downloadAuthData.authorizationToken}`;
      const expiresAt = new Date(Date.now() + validDurationInSeconds * 1000).toISOString();

      return new Response(
        JSON.stringify({
          success: true,
          signedUrl,
          expiresAt,
          message: 'Video URL generated successfully (Backblaze)'
        }),
        { headers: corsHeaders }
      );

    } else {
      // Legacy Supabase storage support
      const expiresIn = expiryHours * 3600;
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('videos')
        .createSignedUrl(videoUrl, expiresIn);

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
          expiresAt,
          message: 'Video URL generated successfully (Supabase)'
        }),
        { headers: corsHeaders }
      );
    }

  } catch (error) {
    console.error('Get video URL function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
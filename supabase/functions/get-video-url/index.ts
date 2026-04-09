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

// Bandwidth tracking - stored in-memory for this function instance
const bandwidthTracker = {
  dailyDownloads: 0,
  lastReset: new Date().toDateString(),
  limit: 1024 * 1024 * 1024, // 1 GB in bytes
  
  reset() {
    const today = new Date().toDateString();
    if (today !== this.lastReset) {
      this.dailyDownloads = 0;
      this.lastReset = today;
      console.log('Daily bandwidth counter reset');
    }
  },
  
  addDownload(bytes: number) {
    this.reset();
    this.dailyDownloads += bytes;
    return this.dailyDownloads;
  },
  
  getRemainingBandwidth(): number {
    this.reset();
    return Math.max(0, this.limit - this.dailyDownloads);
  },
  
  isLimitExceeded(): boolean {
    this.reset();
    return this.dailyDownloads >= this.limit;
  }
};

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
        .select('id, expires_at')
        .eq('user_id', user.id)
        .eq('content_id', movieId)
        .eq('content_type', 'movie')
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
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

    // Check if it's a Backblaze URL (must contain backblaze domains)
    const isBackblazeUrl = videoUrl.includes('backblazeb2.com') || videoUrl.includes('b2cdn.com');

    if (isBackblazeUrl) {
      // Generate Backblaze signed URL
      const b2KeyId = Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY_ID');
      const b2AppKey = Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY');
      const b2BucketName = Deno.env.get('BACKBLAZE_B2_BUCKET_NAME');
      const b2BucketId = Deno.env.get('BACKBLAZE_B2_BUCKET_ID');

      if (!b2KeyId || !b2AppKey || !b2BucketName || !b2BucketId) {
        console.error('Backblaze credentials not configured properly', {
          hasKeyId: !!b2KeyId,
          hasAppKey: !!b2AppKey,
          hasBucketName: !!b2BucketName,
          hasBucketId: !!b2BucketId,
          videoUrl
        });
        return new Response(
          JSON.stringify({ error: 'Backblaze credentials not properly configured' }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Extract file path (remove domain and bucket from full URL)
      let filePath = videoUrl;
      if (videoUrl.includes('://')) {
        try {
          const urlObj = new URL(videoUrl);
          const segments = urlObj.pathname.split('/').filter(Boolean);

          if (segments[0] === 'file' && segments.length >= 3) {
            // backblaze direct/download URL format: /file/<bucket>/<path>
            filePath = segments.slice(2).join('/');
          } else if (segments[0] === b2BucketName && segments.length >= 2) {
            // possible /<bucket>/<path> format
            filePath = segments.slice(1).join('/');
          } else {
            const bucketIndex = segments.indexOf(b2BucketName);
            if (bucketIndex >= 0 && segments.length > bucketIndex + 1) {
              filePath = segments.slice(bucketIndex + 1).join('/');
            } else {
              filePath = segments.join('/');
            }
          }
        } catch (parseError) {
          console.error('URL parse error:', parseError, 'for URL:', videoUrl);
          filePath = videoUrl;
        }
      }

      if (!filePath || !filePath.includes('.')) {
        console.error('Invalid file path extracted:', filePath, 'from URL:', videoUrl);
        return new Response(
          JSON.stringify({ error: 'Invalid video file path format' }),
          { status: 400, headers: corsHeaders }
        );
      }

      console.log('Successfully extracted Backblaze file path:', {
        originalUrl: videoUrl,
        extractedPath: filePath,
        hasDotExtension: filePath.includes('.')
      });

      const authResponse = await fetch(`${BACKBLAZE_API_URL}/b2api/v2/b2_authorize_account`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${b2KeyId}:${b2AppKey}`)}`
        }
      });

      if (!authResponse.ok) {
        const authErrorBody = await authResponse.text();
        
        // Check if it's a bandwidth limit error (503 Service Unavailable or 429 Too Many Requests)
        if (authResponse.status === 503 || authResponse.status === 429) {
          console.warn('Backblaze bandwidth limit likely exceeded', {
            status: authResponse.status,
            statusText: authResponse.statusText
          });
          
          // Fall back to Supabase storage
          console.log('Falling back to Supabase storage due to B2 bandwidth limit');
          const expiresIn = expiryHours * 3600;
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('videos')
            .createSignedUrl(videoUrl, expiresIn);

          if (signedUrlError) {
            return new Response(
              JSON.stringify({ 
                error: 'Backblaze bandwidth exceeded and Supabase fallback failed',
                details: signedUrlError.message
              }),
              { status: 503, headers: { ...corsHeaders, 'X-Bandwidth-Limited': 'true' } }
            );
          }

          const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();
          return new Response(
            JSON.stringify({
              success: true,
              signedUrl: signedUrlData.signedUrl,
              expiresAt,
              message: 'Video URL generated via Supabase (Backblaze bandwidth limited)',
              source: 'supabase-fallback'
            }),
            { 
              headers: { 
                ...corsHeaders, 
                'X-Bandwidth-Limited': 'true',
                'Cache-Control': 'public, max-age=3600'
              } 
            }
          );
        }
        
        console.error('Backblaze authorization failed', {
          status: authResponse.status,
          statusText: authResponse.statusText,
          body: authErrorBody
        });
        return new Response(
          JSON.stringify({ error: 'Failed to authorize with Backblaze', details: authErrorBody }),
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
          bucketId: b2BucketId,
          fileNamePrefix: filePath,
          validDurationInSeconds
        })
      });

      if (!downloadAuthResponse.ok) {
        const downloadErrorBody = await downloadAuthResponse.text();
        
        // Check if it's a bandwidth limit error
        if (downloadAuthResponse.status === 503 || downloadAuthResponse.status === 429) {
          console.warn('Backblaze download bandwidth limit likely exceeded', {
            status: downloadAuthResponse.status,
            statusText: downloadAuthResponse.statusText
          });
          
          // Fall back to Supabase storage
          console.log('Falling back to Supabase storage due to B2 bandwidth limit');
          const expiresIn = expiryHours * 3600;
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('videos')
            .createSignedUrl(videoUrl, expiresIn);

          if (signedUrlError) {
            return new Response(
              JSON.stringify({ 
                error: 'Backblaze bandwidth exceeded and Supabase fallback failed',
                details: signedUrlError.message
              }),
              { status: 503, headers: { ...corsHeaders, 'X-Bandwidth-Limited': 'true' } }
            );
          }

          const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();
          return new Response(
            JSON.stringify({
              success: true,
              signedUrl: signedUrlData.signedUrl,
              expiresAt,
              message: 'Video URL generated via Supabase (Backblaze bandwidth limited)',
              source: 'supabase-fallback'
            }),
            { 
              headers: { 
                ...corsHeaders, 
                'X-Bandwidth-Limited': 'true',
                'Cache-Control': 'public, max-age=3600'
              } 
            }
          );
        }
        
        console.error('Backblaze download authorization failed', {
          status: downloadAuthResponse.status,
          statusText: downloadAuthResponse.statusText,
          body: downloadErrorBody,
          bucketId: b2BucketId,
          fileNamePrefix: filePath
        });
        return new Response(
          JSON.stringify({ error: 'Failed to generate download authorization', details: downloadErrorBody }),
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
          message: 'Video URL generated successfully (Backblaze)',
          source: 'backblaze'
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Cache-Control': `public, max-age=${validDurationInSeconds}`,
            'X-Signed-Url-Expires': expiresAt
          } 
        }
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
          message: 'Video URL generated successfully (Supabase)',
          source: 'supabase'
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Cache-Control': `public, max-age=${expiresIn}`,
            'X-Signed-Url-Expires': expiresAt
          } 
        }
      );
    }

  } catch (error) {
    console.error('Get video URL function error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error
    });
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
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

    const url = new URL(req.url);
    const urlMovieId = url.searchParams.get('movieId');
    const urlContentId = url.searchParams.get('contentId');
    const urlContentType = url.searchParams.get('contentType')?.toLowerCase();
    const isStreamingRequest = url.searchParams.get('stream') === 'true';

    let movieId = urlMovieId;
    let contentId = urlContentId;
    let contentType = urlContentType || 'movie';
    let expiryHours = 24;

    if (!movieId && !contentId) {
      const body = await req.json().catch(() => ({}));
      movieId = body.movieId;
      contentId = body.contentId;
      contentType = (body.contentType || contentType).toLowerCase();
      expiryHours = body.expiryHours || expiryHours;
    }

    if (!movieId && !contentId) {
      return new Response(
        JSON.stringify({ error: 'Movie or content ID is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!['movie', 'episode'].includes(contentType)) {
      contentType = 'movie';
    }

    const contentKey = contentId || movieId;
    const query = contentType === 'episode'
      ? 'id, video_url, season_id, seasons(tv_show_id)'
      : 'id, video_url, status, price';

    const { data: content, error: contentError } = await supabase
      .from(contentType === 'episode' ? 'episodes' : 'movies')
      .select(query)
      .eq('id', contentKey)
      .maybeSingle();

    if (contentError || !content) {
      return new Response(
        JSON.stringify({ error: `${contentType === 'episode' ? 'Episode' : 'Movie'} not found` }),
        { status: 404, headers: corsHeaders }
      );
    }

    console.log('Content lookup:', {
      contentType,
      contentKey,
      found: !!content,
      hasVideoUrl: !!content?.video_url,
      contentError: contentError ? { code: contentError.code, message: contentError.message } : null
    });

    if (movieError || !movie) {
      return new Response(
        JSON.stringify({ error: 'Movie not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (contentType === 'movie' && content.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Movie not available', status: content.status }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Check user access - super admin has full access
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleError && roleError.code !== 'PGRST116') {
      console.error('Role check error:', roleError);
    }

    const isSuperAdmin = roleData?.role === 'super_admin';

    if (!isSuperAdmin) {
      let hasAccess = false;

      if (contentType === 'movie') {
        const { data: purchase, error: purchaseError } = await supabase
          .from('purchases')
          .select('id')
          .eq('user_id', user.id)
          .eq('content_id', contentKey)
          .eq('content_type', 'movie')
          .maybeSingle();

        if (purchaseError && purchaseError.code !== 'PGRST116') {
          console.error('Purchase check error:', purchaseError);
        }

        const { data: rental, error: rentalError } = await supabase
          .from('rentals')
          .select('id, expires_at, status')
          .eq('user_id', user.id)
          .eq('content_id', contentKey)
          .eq('content_type', 'movie')
          .eq('status', 'active')
          .gte('expires_at', new Date().toISOString())
          .maybeSingle();

        if (rentalError && rentalError.code !== 'PGRST116') {
          console.error('Rental check error:', rentalError);
        }

        hasAccess = !!purchase || !!rental;
      } else if (contentType === 'episode') {
        const seasonId = content.season_id;
        const tvShowId = content.seasons?.tv_show_id;

        const episodePurchaseQuery = supabase
          .from('purchases')
          .select('id')
          .eq('user_id', user.id)
          .eq('content_id', contentKey)
          .eq('content_type', 'episode')
          .maybeSingle();

        const episodeRentalQuery = supabase
          .from('rentals')
          .select('id, expires_at, status')
          .eq('user_id', user.id)
          .eq('content_id', contentKey)
          .eq('content_type', 'episode')
          .eq('status', 'active')
          .gte('expires_at', new Date().toISOString())
          .maybeSingle();

        const [episodePurchaseResult, episodeRentalResult] = await Promise.all([
          episodePurchaseQuery,
          episodeRentalQuery,
        ]);

        const episodePurchase = episodePurchaseResult?.data;
        const episodeRental = episodeRentalResult?.data;
        hasAccess = !!episodePurchase || !!episodeRental;

        if (!hasAccess && seasonId) {
          const [seasonPurchaseResult, seasonRentalResult] = await Promise.all([
            supabase
              .from('purchases')
              .select('id')
              .eq('user_id', user.id)
              .eq('content_id', seasonId)
              .eq('content_type', 'season')
              .maybeSingle(),
            supabase
              .from('rentals')
              .select('id, expires_at, status')
              .eq('user_id', user.id)
              .eq('content_id', seasonId)
              .eq('content_type', 'season')
              .eq('status', 'active')
              .gte('expires_at', new Date().toISOString())
              .maybeSingle(),
          ]);

          const seasonPurchase = seasonPurchaseResult?.data;
          const seasonRental = seasonRentalResult?.data;
          hasAccess = !!seasonPurchase || !!seasonRental;
        }

        if (!hasAccess && tvShowId) {
          const { data: showPurchase, error: showPurchaseError } = await supabase
            .from('purchases')
            .select('id')
            .eq('user_id', user.id)
            .eq('content_id', tvShowId)
            .in('content_type', ['tv', 'tv_show'])
            .maybeSingle();

          if (showPurchaseError && showPurchaseError.code !== 'PGRST116') {
            console.error('TV show purchase check error:', showPurchaseError);
          }

          hasAccess = !!showPurchase;
        }
      }

      if (!hasAccess) {
        console.error('Access denied:', {
          userId: user.id,
          contentType,
          contentKey,
          isEpisode: contentType === 'episode',
        });

        return new Response(
          JSON.stringify({
            error: 'Access denied. Purchase or rent this content to watch.',
            details: { contentType, contentKey }
          }),
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
        console.warn('Backblaze credentials not configured, falling back to Supabase storage', {
          hasKeyId: !!b2KeyId,
          hasAppKey: !!b2AppKey,
          hasBucketName: !!b2BucketName,
          hasBucketId: !!b2BucketId,
          videoUrl
        });
        
        // Fall back to Supabase storage
        console.log('Attempting Supabase storage fallback for Backblaze URL:', videoUrl);
        
        // Extract potential file path from Backblaze URL for Supabase storage
        let supabaseFilePath = videoUrl;
        try {
          const urlObj = new URL(videoUrl);
          // Remove the Backblaze domain and /file/ prefix to get the path
          const pathParts = urlObj.pathname.split('/').filter(Boolean);
          if (pathParts[0] === 'file' && pathParts.length > 1) {
            // Remove 'file' and bucket name, keep the rest as path
            supabaseFilePath = pathParts.slice(2).join('/');
          }
          console.log('Extracted Supabase file path:', supabaseFilePath);
        } catch (parseError) {
          console.error('Failed to parse Backblaze URL for Supabase fallback:', parseError);
          supabaseFilePath = videoUrl; // Use as-is if parsing fails
        }
        
        const expiresIn = expiryHours * 3600;
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('videos')
          .createSignedUrl(supabaseFilePath, expiresIn);

        if (signedUrlError) {
          console.error('Supabase fallback failed:', signedUrlError);
          return new Response(
            JSON.stringify({ 
              error: 'Video temporarily unavailable',
              details: 'Storage configuration issue - video cannot be accessed at this time. Please configure Backblaze credentials or ensure videos exist in Supabase storage.',
              debug: {
                backblazeConfigured: false,
                supabaseFallbackFailed: true,
                originalUrl: videoUrl,
                extractedPath: supabaseFilePath,
                setupGuide: 'See BACKBLAZE_SETUP.md for configuration instructions'
              }
            }),
            { status: 503, headers: corsHeaders }
          );
        }

        const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();
        return new Response(
          JSON.stringify({
            success: true,
            signedUrl: signedUrlData.signedUrl,
            expiresAt,
            message: 'Video URL generated via Supabase (Backblaze credentials missing)',
            source: 'supabase-fallback'
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Cache-Control': 'public, max-age=3600'
            } 
          }
        );
      }

      console.log('Backblaze credentials configured, generating signed URL for:', {
        bucketName: b2BucketName,
        videoUrl: videoUrl.substring(0, 100) + '...' // Truncate for logging
      });

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

      // For video streaming, we need to proxy the request to avoid CORS issues
      // Check if this is a direct video request (not just URL generation)
      if (isStreamingRequest) {
        console.log('Proxying video request to avoid CORS issues');
        
        try {
          const videoResponse = await fetch(signedUrl, {
            headers: {
              'Range': req.headers.get('Range') || '',
              'User-Agent': req.headers.get('User-Agent') || 'Supabase-Video-Proxy/1.0',
              'Accept': req.headers.get('Accept') || '*/*',
            }
          });

          if (!videoResponse.ok) {
            console.error('Failed to proxy video request:', {
              status: videoResponse.status,
              statusText: videoResponse.statusText
            });
            return new Response(
              JSON.stringify({ error: 'Failed to stream video' }),
              { status: 500, headers: corsHeaders }
            );
          }

          // Return the video content with appropriate headers for streaming
          const responseHeaders = new Headers({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, User-Agent, Accept',
            'Content-Type': videoResponse.headers.get('Content-Type') || 'video/mp4',
            'Content-Length': videoResponse.headers.get('Content-Length') || '',
            'Accept-Ranges': videoResponse.headers.get('Accept-Ranges') || 'bytes',
            'Cache-Control': `public, max-age=${validDurationInSeconds}`,
            'X-Signed-Url-Expires': expiresAt,
            'Content-Range': videoResponse.headers.get('Content-Range') || '',
            'ETag': videoResponse.headers.get('ETag') || '',
            'Last-Modified': videoResponse.headers.get('Last-Modified') || '',
          });

          return new Response(videoResponse.body, {
            status: videoResponse.status,
            headers: responseHeaders
          });
        } catch (proxyError) {
          console.error('Video proxy error:', proxyError);
          return new Response(
            JSON.stringify({ error: 'Failed to proxy video content' }),
            { status: 500, headers: corsHeaders }
          );
        }
      }

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
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

type VideoContentType = 'movie' | 'episode';

interface VideoContent {
  id: string;
  video_url: string | null;
  status: string | null;
  contentType: VideoContentType;
  season_id?: string | null;
}

interface StreamTokenPayload {
  userId: string;
  contentId: string;
  contentType: VideoContentType;
  exp: number;
}

function base64UrlEncode(value: string) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return atob(padded);
}

async function signStreamToken(payload: StreamTokenPayload, secret: string) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
  const encodedSignature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  return `${encodedPayload}.${encodedSignature}`;
}

async function verifyStreamToken(token: string | null, secret: string): Promise<StreamTokenPayload | null> {
  try {
    if (!token || !token.includes('.')) return null;

    const [encodedPayload, encodedSignature] = token.split('.');
    if (!encodedPayload || !encodedSignature) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as StreamTokenPayload;
    const expectedToken = await signStreamToken(payload, secret);
    const expectedSignature = expectedToken.split('.')[1];
    if (expectedSignature !== encodedSignature) return null;

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.contentId || (payload.contentType !== 'movie' && payload.contentType !== 'episode')) return null;

    return payload;
  } catch {
    return null;
  }
}

function buildProxyStreamUrl(
  supabaseUrl: string,
  contentId: string,
  contentType: VideoContentType,
  streamToken: string,
) {
  const params = new URLSearchParams({
    stream: 'true',
    contentId,
    contentType,
    token: streamToken,
  });

  if (contentType === 'episode') {
    params.set('episodeId', contentId);
  } else {
    params.set('movieId', contentId);
  }

  return `${supabaseUrl}/functions/v1/get-video-url?${params.toString()}`;
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodeB2Path(filePath: string) {
  return filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function buildB2DownloadUrl(downloadUrl: string, bucketName: string, filePath: string, authorizationToken: string) {
  const encodedBucket = encodeURIComponent(bucketName);
  const encodedPath = encodeB2Path(filePath);
  const url = new URL(`/file/${encodedBucket}/${encodedPath}`, downloadUrl);
  url.searchParams.set('Authorization', authorizationToken);
  return url.toString();
}

function getB2Credentials() {
  return {
    keyId:
      Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY_ID') ||
      Deno.env.get('BACKBLAZE_API_KEY_ID') ||
      Deno.env.get('BACKBLAZE_API_KEY_ID_ID'),
    appKey:
      Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY') ||
      Deno.env.get('BACKBLAZE_API_KEY'),
    bucketName: Deno.env.get('BACKBLAZE_B2_BUCKET_NAME'),
    bucketId: Deno.env.get('BACKBLAZE_B2_BUCKET_ID'),
  };
}

function buildVideoProxyHeaders(req: Request, authorization?: string) {
  const headers: Record<string, string> = {
    'User-Agent': req.headers.get('User-Agent') || 'Supabase-Video-Proxy/1.0',
    'Accept': req.headers.get('Accept') || '*/*',
  };

  const range = req.headers.get('Range');
  if (range) headers.Range = range;
  if (authorization) headers.Authorization = authorization;

  return headers;
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

    const url = new URL(req.url);
    const movieIdFromUrl = url.searchParams.get('movieId');
    const episodeIdFromUrl = url.searchParams.get('episodeId');
    const contentIdFromUrl = url.searchParams.get('contentId');
    const isStreamingRequest = url.searchParams.get('stream') === 'true';
    const streamToken = url.searchParams.get('token');
    const requestedContentType = url.searchParams.get('contentType');

    // Get content identifier from either URL params (for streaming) or request body
    let contentId = contentIdFromUrl || episodeIdFromUrl || movieIdFromUrl;
    let contentType: VideoContentType =
      requestedContentType === 'episode' || episodeIdFromUrl ? 'episode' : 'movie';
    let expiryHours = 24;
    let user: { id: string } | null = null;

    if (isStreamingRequest) {
      const verifiedToken = await verifyStreamToken(streamToken, supabaseKey);
      if (!verifiedToken) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired stream token' }),
          { status: 401, headers: corsHeaders }
        );
      }

      contentId = verifiedToken.contentId;
      contentType = verifiedToken.contentType;
      user = { id: verifiedToken.userId };
    } else {
      // Verify authentication for URL generation requests.
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Missing Authorization header' }),
          { status: 401, headers: corsHeaders }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ error: 'Invalid authentication token' }),
          { status: 401, headers: corsHeaders }
        );
      }

      user = authUser;
    }

    if (!contentId && !isStreamingRequest) {
      // Try to get from request body
      const body = await req.json().catch(() => ({}));
      contentId = body.movieId || body.contentId || body.episodeId;
      contentType = body.contentType === 'episode' ? 'episode' : 'movie';
      expiryHours = body.expiryHours || 24;
    }

    if (!contentId) {
      return new Response(
        JSON.stringify({ error: 'Content ID is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unable to resolve authenticated user' }),
        { status: 401, headers: corsHeaders }
      );
    }

    let content: VideoContent | null = null;
    let contentError: unknown = null;

    if (contentType === 'episode') {
      const { data, error } = await supabase
        .from('episodes')
        .select('id, video_url, status, season_id')
        .eq('id', contentId)
        .single();

      content = data ? { ...data, contentType: 'episode' } : null;
      contentError = error;
    } else {
      const { data, error } = await supabase
        .from('movies')
        .select('id, video_url, status, price')
        .eq('id', contentId)
        .single();

      content = data ? { ...data, contentType: 'movie' } : null;
      contentError = error;
    }

    console.log('Video content lookup:', {
      contentId,
      contentType,
      found: !!content,
      status: content?.status,
      hasVideoUrl: !!content?.video_url,
      contentError: contentError ? {
        code: (contentError as { code?: string }).code,
        message: (contentError as { message?: string }).message
      } : null
    });

    if (contentError || !content) {
      return new Response(
        JSON.stringify({ error: 'Content not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (content.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Content not available', status: content.status }),
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
      const { data: purchase, error: purchaseError } = contentType === 'movie'
        ? await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('content_id', contentId)
        .eq('content_type', 'movie')
        .maybeSingle()
        : { data: null, error: null };

      if (purchaseError && purchaseError.code !== 'PGRST116') {
        console.error('Purchase check error:', purchaseError);
      }

      // PHASE 6: Check canonical rental_access table first
      // This is the source of truth for active rental access
      const now = new Date().toISOString();
      let rentalAccess = null;
      let rentalAccessError = null;

      if (contentType === 'episode') {
        const { data, error } = await supabase
          .from('rental_access')
          .select('id, expires_at, status')
          .eq('user_id', user.id)
          .eq('episode_id', contentId)
          .eq('status', 'paid')
          .is('revoked_at', null)
          .gt('expires_at', now)
          .maybeSingle();

        rentalAccess = data;
        rentalAccessError = error;

        if (!rentalAccess && content.season_id) {
          const { data: seasonRental, error: seasonRentalError } = await supabase
            .from('rental_access')
            .select('id, expires_at, status')
            .eq('user_id', user.id)
            .eq('season_id', content.season_id)
            .eq('status', 'paid')
            .is('revoked_at', null)
            .gt('expires_at', now)
            .maybeSingle();

          rentalAccess = seasonRental;
          rentalAccessError = seasonRentalError;
        }
      } else {
        const { data, error } = await supabase
        .from('rental_access')
        .select('id, expires_at, status')
        .eq('user_id', user.id)
          .eq('movie_id', contentId)
        .eq('status', 'paid')
        .is('revoked_at', null)
        .gt('expires_at', now)
        .maybeSingle();

        rentalAccess = data;
        rentalAccessError = error;
      }

      if (rentalAccessError && rentalAccessError.code !== 'PGRST116') {
        console.error('Rental access check error:', rentalAccessError);
      }

      // Fallback: check legacy rentals table for backward compatibility
      let legacyRental = null;
      if (!rentalAccess && contentType === 'movie') {
        const { data: rental, error: rentalError } = await supabase
          .from('rentals')
          .select('id, expires_at, user_id, content_id, content_type, status')
          .eq('user_id', user.id)
          .eq('content_id', contentId)
          .eq('content_type', 'movie')
          .eq('status', 'completed')
          .gte('expires_at', new Date().toISOString())
          .maybeSingle();

        if (rentalError && rentalError.code !== 'PGRST116') {
          console.error('Legacy rental check error:', rentalError);
        }
        legacyRental = rental;
      }

      console.log('Access check for user:', {
        userId: user.id,
        contentId,
        contentType,
        hasRentalAccess: !!rentalAccess,
        hasLegacyRental: !!legacyRental,
        hasPurchase: !!purchase,
        currentTime: now
      });

      if (!purchase && !rentalAccess && !legacyRental) {
        console.error('Access denied:', {
          userId: user.id,
          contentId,
          contentType,
          hasPurchase: !!purchase,
          hasRentalAccess: !!rentalAccess,
          hasLegacyRental: !!legacyRental,
        });

        // Build a more informative error message
        const errorDetails = {
          error: 'Access denied. Purchase or rent this movie to watch.',
          debug: {
            contentId,
            contentType,
            hasPurchase: !!purchase,
            hasRentalAccess: !!rentalAccess,
            contentStatus: content?.status
          }
        };

        return new Response(
          JSON.stringify(errorDetails),
          { status: 403, headers: corsHeaders }
        );
      }
    }

    if (!content.video_url) {
      return new Response(
        JSON.stringify({ error: 'Video file not available' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const videoUrl = content.video_url;

    // Check if it's a Backblaze URL (must contain backblaze domains)
    const isBackblazeUrl = videoUrl.includes('backblazeb2.com') || videoUrl.includes('b2cdn.com');

    if (isBackblazeUrl) {
      // Generate Backblaze signed URL
      const {
        keyId: b2KeyId,
        appKey: b2AppKey,
        bucketName: b2BucketName,
        bucketId: b2BucketId,
      } = getB2Credentials();

      if (!b2KeyId || !b2AppKey || !b2BucketName || !b2BucketId) {
        console.warn('Backblaze credentials not configured', {
          hasKeyId: !!b2KeyId,
          hasAppKey: !!b2AppKey,
          hasBucketName: !!b2BucketName,
          hasBucketId: !!b2BucketId,
          contentId,
          contentType,
          videoUrl
        });

        return new Response(
          JSON.stringify({
            error: 'Video temporarily unavailable',
            details: 'Backblaze credentials are missing or incomplete.',
            debug: {
              contentId,
              contentType,
              backblazeConfigured: false,
            }
          }),
          { status: 503, headers: corsHeaders }
        );
      }

      console.log('Backblaze credentials configured, generating signed URL for:', {
        bucketName: b2BucketName,
        videoUrl: videoUrl.substring(0, 100) + '...' // Truncate for logging
      });

      // Check if this is a Backblaze API endpoint URL (b2_download_file_by_id)
      const isB2ApiDownloadUrl = videoUrl.includes('/b2api/') && videoUrl.includes('b2_download_file_by_id');
      
      if (isB2ApiDownloadUrl) {
        console.log('Detected Backblaze API download endpoint:', { contentId, contentType });
        
        const authResponse = await fetch(`${BACKBLAZE_API_URL}/b2api/v2/b2_authorize_account`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${btoa(`${b2KeyId}:${b2AppKey}`)}`
          }
        });

        if (!authResponse.ok) {
          const authErrorBody = await authResponse.text();
          console.error('Backblaze authorization failed for API endpoint:', {
            status: authResponse.status,
            body: authErrorBody
          });
          return new Response(
            JSON.stringify({ error: 'Failed to authorize with Backblaze', details: authErrorBody }),
            { status: 500, headers: corsHeaders }
          );
        }

        const authData: B2AuthResponse = await authResponse.json();
        const expiresAt = new Date(Date.now() + 7200 * 1000).toISOString(); // 2 hour expiry

        if (isStreamingRequest) {
          const videoResponse = await fetch(videoUrl, {
            headers: buildVideoProxyHeaders(req, authData.authorizationToken),
          });

          if (!videoResponse.ok) {
            console.error('Failed to proxy B2 API video request:', {
              status: videoResponse.status,
              statusText: videoResponse.statusText,
              contentId,
              contentType,
            });
            return new Response(
              JSON.stringify({ error: 'Failed to stream video' }),
              { status: 500, headers: corsHeaders }
            );
          }

          const responseHeaders = new Headers({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, User-Agent, Accept',
            'Content-Type': videoResponse.headers.get('Content-Type') || 'video/mp4',
            'Content-Length': videoResponse.headers.get('Content-Length') || '',
            'Accept-Ranges': videoResponse.headers.get('Accept-Ranges') || 'bytes',
            'Cache-Control': 'private, max-age=300',
            'X-Signed-Url-Expires': expiresAt,
            'Content-Range': videoResponse.headers.get('Content-Range') || '',
            'ETag': videoResponse.headers.get('ETag') || '',
            'Last-Modified': videoResponse.headers.get('Last-Modified') || '',
          });

          return new Response(videoResponse.body, {
            status: videoResponse.status,
            headers: responseHeaders
          });
        }

        const proxyToken = await signStreamToken(
          {
            userId: user.id,
            contentId,
            contentType,
            exp: Math.floor(Date.now() / 1000) + 7200,
          },
          supabaseKey,
        );
        const signedUrl = buildProxyStreamUrl(supabaseUrl, contentId, contentType, proxyToken);
        
        console.log('Successfully generated protected proxy URL for B2 API endpoint');
        
        return new Response(
          JSON.stringify({
            success: true,
            signedUrl,
            expiresAt,
            message: 'Video URL generated successfully (Backblaze API)',
            source: 'backblaze-api'
          }),
          {
            headers: {
              ...corsHeaders,
              'Cache-Control': 'public, max-age=7200',
              'X-Signed-Url-Expires': expiresAt
            }
          }
        );
      }

      // Extract file path (remove domain and bucket from full URL)
      let filePath = videoUrl;
      if (videoUrl.includes('://')) {
        try {
          const urlObj = new URL(videoUrl);
          const segments = urlObj.pathname.split('/').filter(Boolean).map(safeDecodeURIComponent);

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
      const backblazeSignedUrl = buildB2DownloadUrl(
        authData.downloadUrl,
        b2BucketName,
        filePath,
        downloadAuthData.authorizationToken,
      );
      const expiresAt = new Date(Date.now() + validDurationInSeconds * 1000).toISOString();

      // For video streaming, we need to proxy the request to avoid CORS issues
      // Check if this is a direct video request (not just URL generation)
      if (isStreamingRequest) {
        console.log('Proxying video request to avoid CORS issues');

        try {
          const videoResponse = await fetch(backblazeSignedUrl, {
            headers: buildVideoProxyHeaders(req),
          });

          if (!videoResponse.ok) {
            console.error('Failed to proxy video request:', {
              status: videoResponse.status,
              statusText: videoResponse.statusText,
              contentId,
              contentType,
              filePath,
              responseBody: await videoResponse.text().catch(() => null),
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

      const proxyToken = await signStreamToken(
        {
          userId: user.id,
          contentId,
          contentType,
          exp: Math.floor(Date.now() / 1000) + validDurationInSeconds,
        },
        supabaseKey,
      );
      const signedUrl = buildProxyStreamUrl(supabaseUrl, contentId, contentType, proxyToken);

      return new Response(
        JSON.stringify({
          success: true,
          signedUrl,
          expiresAt,
          message: 'Video proxy URL generated successfully (Backblaze)',
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

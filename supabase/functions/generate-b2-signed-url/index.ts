import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { corsHeaders } from '../_shared/cors.ts';

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Support both 'movieId' and 'contentId' parameters for backward compatibility
    const { contentId, movieId, contentType = 'movie' } = await req.json();
    const id = contentId || movieId;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Content ID is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check user access (rental, purchase, or super admin)
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isSuperAdmin = roleData?.role === 'super_admin';

    if (!isSuperAdmin) {
      // Check for purchase
      const { data: purchase } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('content_id', id)
        .eq('content_type', contentType)
        .single();

      // Check for active rental
      const { data: rental } = await supabase
        .from('rentals')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_id', id)
        .eq('content_type', contentType)
        .eq('status', 'active')
        .or(
          `expires_at.gte.${new Date().toISOString()},expiration_date.gte.${new Date().toISOString()}`
        )
        .single();

      if (!purchase && !rental) {
        return new Response(
          JSON.stringify({ error: 'Access denied. Purchase or rent this content to watch.' }),
          { status: 403, headers: corsHeaders }
        );
      }
    }

    // Get content video URL
    const tableName = contentType === 'movie' ? 'movies' : (contentType === 'episode' ? 'episodes' : 'seasons');
    const { data: content, error: contentError } = await supabase
      .from(tableName)
      .select('video_url, status')
      .eq('id', id)
      .single();

    if (contentError || !content) {
      return new Response(
        JSON.stringify({ error: 'Content not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (content.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Content not available' }),
        { status: 403, headers: corsHeaders }
      );
    }

    if (!content.video_url) {
      return new Response(
        JSON.stringify({ error: 'Video file not available' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const videoUrl = content.video_url;

    // Check if it's a Backblaze URL
    const isBackblazeUrl = videoUrl.includes('backblazeb2.com') || videoUrl.includes('b2cdn.com');

    if (isBackblazeUrl) {
      const b2KeyId = Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY_ID');
      const b2AppKey = Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY');
      const b2BucketName = Deno.env.get('BACKBLAZE_B2_BUCKET_NAME');
      const b2BucketId = Deno.env.get('BACKBLAZE_B2_BUCKET_ID');

      if (!b2KeyId || !b2AppKey || !b2BucketName || !b2BucketId) {
        console.error('Backblaze credentials not configured properly', {
          hasKeyId: !!b2KeyId,
          hasAppKey: !!b2AppKey,
          hasBucketName: !!b2BucketName,
          hasBucketId: !!b2BucketId
        });
        return new Response(
          JSON.stringify({ error: 'Backblaze credentials not properly configured' }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Extract file path (handle various URL formats)
      let filePath = videoUrl;
      if (videoUrl.includes('://')) {
        try {
          const urlObj = new URL(videoUrl);
          const segments = urlObj.pathname.split('/').filter(Boolean);

          if (segments[0] === 'file' && segments.length >= 3) {
            filePath = segments.slice(2).join('/');
          } else if (segments[0] === b2BucketName && segments.length >= 2) {
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
          console.error('URL parse error:', parseError);
          filePath = videoUrl;
        }
      }

      if (!filePath || !filePath.includes('.')) {
        return new Response(
          JSON.stringify({ error: 'Invalid video file path format' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Authorize with Backblaze B2
      const authResponse = await fetch(`${BACKBLAZE_API_URL}/b2api/v2/b2_authorize_account`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${b2KeyId}:${b2AppKey}`)}`
        }
      });

      if (!authResponse.ok) {
        // Check if it's a bandwidth limit error
        if (authResponse.status === 503 || authResponse.status === 429) {
          console.warn('Backblaze bandwidth limit exceeded on auth');
          
          // Fall back to Supabase storage
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('videos')
            .createSignedUrl(videoUrl, 86400);

          if (signedUrlError) {
            return new Response(
              JSON.stringify({ 
                error: 'Backblaze bandwidth exceeded and Supabase fallback failed'
              }),
              { status: 503, headers: { ...corsHeaders, 'X-Bandwidth-Limited': 'true' } }
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              signedUrl: signedUrlData.signedUrl,
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
              message: 'Using Supabase storage (Backblaze bandwidth limited)',
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

        console.error('Backblaze auth failed:', authResponse.status);
        return new Response(
          JSON.stringify({ error: 'Failed to authorize with Backblaze' }),
          { status: 500, headers: corsHeaders }
        );
      }

      const authData: B2AuthResponse = await authResponse.json();

      // Generate download authorization
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
        // Check for bandwidth limit errors
        if (downloadAuthResponse.status === 503 || downloadAuthResponse.status === 429) {
          console.warn('Backblaze bandwidth limit exceeded on download auth');
          
          // Fall back to Supabase
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('videos')
            .createSignedUrl(videoUrl, 86400);

          if (signedUrlError) {
            return new Response(
              JSON.stringify({ 
                error: 'Backblaze bandwidth exceeded and Supabase fallback failed'
              }),
              { status: 503, headers: { ...corsHeaders, 'X-Bandwidth-Limited': 'true' } }
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              signedUrl: signedUrlData.signedUrl,
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
              message: 'Using Supabase storage (Backblaze bandwidth limited)',
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

        console.error('Backblaze download auth failed:', downloadAuthResponse.status);
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
          message: 'Video URL generated (Backblaze)',
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
      // Supabase storage fallback
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('videos')
        .createSignedUrl(videoUrl, 86400);

      if (signedUrlError) {
        return new Response(
          JSON.stringify({ error: 'Failed to generate video URL' }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          signedUrl: signedUrlData.signedUrl,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          message: 'Video URL generated (Supabase)',
          source: 'supabase'
        }),
        { 
          headers: { 
            ...corsHeaders,
            'Cache-Control': 'public, max-age=86400'
          } 
        }
      );
    }

  } catch (error) {
    console.error('Generate B2 signed URL error:', {
      message: error instanceof Error ? error.message : String(error),
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

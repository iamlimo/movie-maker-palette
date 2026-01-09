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
    const { trailerUrl } = await req.json();

    if (!trailerUrl) {
      throw new Error('Missing trailerUrl');
    }

    // Check if URL is a Backblaze URL
    const isBackblazeUrl = trailerUrl.includes('backblazeb2.com') || trailerUrl.includes('b2cdn.com');
    
    if (!isBackblazeUrl) {
      // Return the URL as-is for non-Backblaze URLs (legacy Supabase storage)
      return new Response(
        JSON.stringify({
          signedUrl: trailerUrl,
          expiresAt: null // No expiry for direct URLs
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Extract file path from Backblaze URL
    const videoPath = trailerUrl;

    // Get Backblaze credentials
    const b2KeyId = Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY_ID');
    const b2AppKey = Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY');
    const b2BucketName = Deno.env.get('BACKBLAZE_B2_BUCKET_NAME');

    if (!b2KeyId || !b2AppKey || !b2BucketName) {
      throw new Error('Backblaze credentials not configured');
    }

    // Authorize with Backblaze B2
    const authResponse = await fetch(`${BACKBLAZE_API_URL}/b2api/v2/b2_authorize_account`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(`${b2KeyId}:${b2AppKey}`)}`
      }
    });

    if (!authResponse.ok) {
      throw new Error('Failed to authorize with Backblaze B2');
    }

    const authData: B2AuthResponse = await authResponse.json();

    // Generate download authorization (1 hour expiry for trailers)
    const validDurationInSeconds = 3600; // 1 hour (shorter than full videos)
    const downloadAuthResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_download_authorization`, {
      method: 'POST',
      headers: {
        'Authorization': authData.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketId: b2BucketName,
        fileNamePrefix: videoPath,
        validDurationInSeconds
      })
    });

    if (!downloadAuthResponse.ok) {
      throw new Error('Failed to generate download authorization');
    }

    const downloadAuthData: B2SignedUrlResponse = await downloadAuthResponse.json();

    // Construct signed URL
    const signedUrl = `${authData.downloadUrl}/file/${b2BucketName}/${videoPath}?Authorization=${downloadAuthData.authorizationToken}`;
    const expiresAt = new Date(Date.now() + validDurationInSeconds * 1000).toISOString();

    return new Response(
      JSON.stringify({
        signedUrl,
        expiresAt
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error generating trailer signed URL:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});

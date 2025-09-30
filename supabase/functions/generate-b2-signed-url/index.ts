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
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { contentId, contentType } = await req.json();

    if (!contentId || !contentType) {
      throw new Error('Missing contentId or contentType');
    }

    // Verify user has access to this content (rental/purchase check)
    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .select('*')
      .eq('user_id', user.id)
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (rentalError || !rental) {
      throw new Error('No active rental found for this content');
    }

    // Get content video URL
    const tableName = contentType === 'movie' ? 'movies' : 'episodes';
    const { data: content, error: contentError } = await supabase
      .from(tableName)
      .select('video_url')
      .eq('id', contentId)
      .single();

    if (contentError || !content || !content.video_url) {
      throw new Error('Content not found or no video URL');
    }

    // Extract Backblaze file path from video_url
    const videoPath = content.video_url;

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

    // Generate download authorization (2 hour expiry)
    const validDurationInSeconds = 7200; // 2 hours
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
    console.error('Error generating signed URL:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});

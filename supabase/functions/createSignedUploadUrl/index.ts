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

    // Check super admin role
    const { data: hasRole, error: roleError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'super_admin' });

    if (roleError || !hasRole) {
      return new Response(
        JSON.stringify({ error: 'Super admin access required' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Parse request body
    const { fileName, bucket, contentType } = await req.json();
    
    console.log('[CREATE-SIGNED-UPLOAD-URL] Request:', { fileName, bucket, contentType });

    // Validate inputs
    if (!fileName || !bucket || !contentType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: fileName, bucket, contentType' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate bucket
    if (!['thumbnails', 'videos'].includes(bucket)) {
      return new Response(
        JSON.stringify({ error: 'Invalid bucket. Must be "thumbnails" or "videos"' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate content type based on bucket
    if (bucket === 'thumbnails' && !contentType.startsWith('image/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid content type for thumbnails bucket. Must be image/*' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (bucket === 'videos' && !contentType.startsWith('video/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid content type for videos bucket. Must be video/*' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Generate file path with proper bucket prefix
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `tv_shows/${bucket === 'thumbnails' ? 'poster' : 'trailer'}/${timestamp}_${sanitizedFileName}`;
    
    console.log('[CREATE-SIGNED-UPLOAD-URL] Generated file path:', filePath);

    // Create signed upload URL with short expiry to avoid token issues
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(filePath);

    if (uploadError) {
      console.error('[CREATE-SIGNED-UPLOAD-URL] Upload URL creation error:', uploadError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create upload URL',
          details: uploadError.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const expiresAt = new Date(Date.now() + 1800 * 1000).toISOString();

    console.log('[CREATE-SIGNED-UPLOAD-URL] Successfully created upload URL');
    return new Response(
      JSON.stringify({
        signedUrl: uploadData.signedUrl,
        filePath: filePath,
        bucket: bucket,
        expiresAt: expiresAt
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('[CREATE-SIGNED-UPLOAD-URL] Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
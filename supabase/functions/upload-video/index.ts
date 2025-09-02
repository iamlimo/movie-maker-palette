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

    const { action, fileName, fileSize, fileType } = await req.json();

    switch (action) {
      case 'get_upload_info': {
        // Validate file type
        const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'application/vnd.apple.mpegurl'];
        const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
        
        const bucket = allowedVideoTypes.includes(fileType) ? 'videos' : 'thumbnails';
        const maxSize = bucket === 'videos' ? 1073741824 : 10485760; // 1GB for videos, 10MB for thumbnails
        
        if (!allowedVideoTypes.includes(fileType) && !allowedImageTypes.includes(fileType)) {
          return new Response(
            JSON.stringify({ error: 'Invalid file type' }),
            { status: 400, headers: corsHeaders }
          );
        }

        if (fileSize > maxSize) {
          return new Response(
            JSON.stringify({ error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB` }),
            { status: 400, headers: corsHeaders }
          );
        }

        // Generate unique file path
        const timestamp = Date.now();
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${timestamp}_${sanitizedFileName}`;

        // Create signed upload URL
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucket)
          .createSignedUploadUrl(filePath, {
            expiresIn: 3600, // 1 hour
          });

        if (uploadError) {
          console.error('Upload URL creation error:', uploadError);
          return new Response(
            JSON.stringify({ error: 'Failed to create upload URL' }),
            { status: 500, headers: corsHeaders }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            uploadUrl: uploadData.signedUrl,
            filePath: filePath,
            bucket: bucket,
            token: uploadData.token
          }),
          { headers: corsHeaders }
        );
      }

      case 'confirm_upload': {
        const { filePath, bucket } = await req.json();
        
        // Verify the file was uploaded successfully
        const { data: fileData, error: fileError } = await supabase.storage
          .from(bucket)
          .list('', {
            search: filePath.split('_').slice(1).join('_') // Remove timestamp prefix for search
          });

        if (fileError || !fileData?.find(file => file.name === filePath)) {
          return new Response(
            JSON.stringify({ error: 'File upload verification failed' }),
            { status: 400, headers: corsHeaders }
          );
        }

        // Get the public URL (for internal reference)
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        return new Response(
          JSON.stringify({
            success: true,
            filePath: filePath,
            publicUrl: urlData.publicUrl
          }),
          { headers: corsHeaders }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: corsHeaders }
        );
    }

  } catch (error) {
    console.error('Upload video function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
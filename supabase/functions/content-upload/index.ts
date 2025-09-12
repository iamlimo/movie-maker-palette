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
    const { data: hasRole, error: roleError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'super_admin' });

    if (roleError || !hasRole) {
      return new Response(
        JSON.stringify({ error: 'Super admin access required' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const requestBody = await req.json();
    console.log('[CONTENT-UPLOAD] Request:', { action: requestBody.action, mediaType: requestBody.mediaType });
    const { action, fileName, fileSize, fileType, filePath, bucket, mediaType } = requestBody;

    switch (action) {
      case 'get_upload_info': {
        console.log('[CONTENT-UPLOAD] Processing unified content upload:', fileName, fileType, fileSize, mediaType);
        
        try {
          // Validate media type
          const validMediaTypes = ['thumbnail', 'landscape_poster', 'slider_cover', 'video', 'trailer'];
          if (!validMediaTypes.includes(mediaType)) {
            return new Response(
              JSON.stringify({ 
                error: 'Invalid media type',
                details: `Media type '${mediaType}' not supported. Valid types: ${validMediaTypes.join(', ')}`
              }),
              { status: 400, headers: corsHeaders }
            );
          }

          // Define bucket and constraints based on media type
          let targetBucket = '';
          let maxSize = 0;
          let allowedTypes: string[] = [];

          switch (mediaType) {
            case 'thumbnail':
              targetBucket = 'thumbnails';
              maxSize = 10 * 1024 * 1024; // 10MB
              allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
              break;
            case 'landscape_poster':
              targetBucket = 'landscape-posters';
              maxSize = 10 * 1024 * 1024; // 10MB
              allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
              break;
            case 'slider_cover':
              targetBucket = 'slider-covers';
              maxSize = 10 * 1024 * 1024; // 10MB
              allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
              break;
            case 'video':
              targetBucket = 'videos';
              maxSize = 2 * 1024 * 1024 * 1024; // 2GB
              allowedTypes = [
                'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 
                'video/x-msvideo', 'video/mpeg', 'video/3gpp', 'video/mov'
              ];
              break;
            case 'trailer':
              targetBucket = 'videos';
              maxSize = 500 * 1024 * 1024; // 500MB
              allowedTypes = [
                'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 
                'video/x-msvideo', 'video/mpeg', 'video/3gpp', 'video/mov'
              ];
              break;
          }

          // File validation
          if (!allowedTypes.includes(fileType)) {
            return new Response(
              JSON.stringify({ 
                error: `Invalid file type for ${mediaType}`,
                details: `File type '${fileType}' not allowed. Supported types: ${allowedTypes.join(', ')}`
              }),
              { status: 400, headers: corsHeaders }
            );
          }

          if (fileSize > maxSize) {
            return new Response(
              JSON.stringify({ 
                error: `File too large for ${mediaType}`,
                details: `Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`
              }),
              { status: 400, headers: corsHeaders }
            );
          }

          // Generate optimized file path with content type organization
          const timestamp = Date.now();
          const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
          const optimizedFilePath = `content/${mediaType}/${timestamp}_${sanitizedFileName}`;
          
          console.log('[CONTENT-UPLOAD] Generated file path:', optimizedFilePath);

          // Create signed upload URL
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(targetBucket)
            .createSignedUploadUrl(optimizedFilePath, {
              expiresIn: 3600, // 1 hour
            });

          if (uploadError) {
            console.error('[CONTENT-UPLOAD] Upload URL creation error:', uploadError);
            return new Response(
              JSON.stringify({ 
                error: 'Failed to create upload URL',
                details: uploadError.message
              }),
              { status: 500, headers: corsHeaders }
            );
          }

          console.log('[CONTENT-UPLOAD] Successfully created upload URL');
          return new Response(
            JSON.stringify({
              uploadUrl: uploadData.signedUrl,
              filePath: optimizedFilePath,
              bucket: targetBucket,
              token: uploadData.token,
              mediaType: mediaType,
              optimization: {
                bucket: targetBucket,
                maxSize: maxSize,
                allowedTypes: allowedTypes
              }
            }),
            { headers: corsHeaders }
          );
        } catch (error) {
          console.error('[CONTENT-UPLOAD] Error in get_upload_info:', error);
          return new Response(
            JSON.stringify({ 
              error: 'Internal server error in get_upload_info',
              details: error.message
            }),
            { status: 500, headers: corsHeaders }
          );
        }
      }

      case 'confirm_upload': {
        console.log('[CONTENT-UPLOAD] Processing confirm_upload for:', filePath, 'in bucket:', bucket);
        
        try {
          // Get the public URL and verify file exists
          const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

          if (!urlData?.publicUrl) {
            console.error('[CONTENT-UPLOAD] File verification failed:', filePath);
            return new Response(
              JSON.stringify({ 
                error: 'File upload verification failed',
                details: 'Unable to generate public URL'
              }),
              { status: 400, headers: corsHeaders }
            );
          }

          console.log('[CONTENT-UPLOAD] File verification successful');
          return new Response(
            JSON.stringify({
              filePath: filePath,
              publicUrl: urlData.publicUrl,
              bucket: bucket,
              optimized: true
            }),
            { headers: corsHeaders }
          );
        } catch (error) {
          console.error('[CONTENT-UPLOAD] Error in confirm_upload:', error);
          return new Response(
            JSON.stringify({ 
              error: 'Internal server error in confirm_upload',
              details: error.message
            }),
            { status: 500, headers: corsHeaders }
          );
        }
      }

      case 'delete_content': {
        console.log('[CONTENT-UPLOAD] Processing delete_content for:', filePath, 'in bucket:', bucket);
        
        try {
          const { error: deleteError } = await supabase.storage
            .from(bucket)
            .remove([filePath]);

          if (deleteError) {
            console.error('[CONTENT-UPLOAD] Delete error:', deleteError);
            return new Response(
              JSON.stringify({ 
                error: 'Failed to delete file',
                details: deleteError.message
              }),
              { status: 500, headers: corsHeaders }
            );
          }

          console.log('[CONTENT-UPLOAD] File deleted successfully');
          return new Response(
            JSON.stringify({
              success: true,
              filePath: filePath,
              bucket: bucket
            }),
            { headers: corsHeaders }
          );
        } catch (error) {
          console.error('[CONTENT-UPLOAD] Error in delete_content:', error);
          return new Response(
            JSON.stringify({ 
              error: 'Internal server error in delete_content',
              details: error.message
            }),
            { status: 500, headers: corsHeaders }
          );
        }
      }

      default:
        console.error('[CONTENT-UPLOAD] Invalid action received:', action);
        return new Response(
          JSON.stringify({ 
            error: 'Invalid action',
            details: `Action '${action}' is not supported. Valid actions: get_upload_info, confirm_upload, delete_content`
          }),
          { status: 400, headers: corsHeaders }
        );
    }

  } catch (error) {
    console.error('[CONTENT-UPLOAD] Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
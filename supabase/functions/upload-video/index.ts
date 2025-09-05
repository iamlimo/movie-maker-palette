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

    // Parse request body once
    const requestBody = await req.json();
    console.log('[UPLOAD-VIDEO] Request received:', { action: requestBody.action, fileName: requestBody.fileName, fileSize: requestBody.fileSize, fileType: requestBody.fileType });
    const { action, fileName, fileSize, fileType, filePath, bucket } = requestBody;

    console.log('[UPLOAD-VIDEO] Processing action:', action);

    switch (action) {
      case 'get_upload_info': {
        console.log('[UPLOAD-VIDEO] Processing get_upload_info for:', fileName, fileType, fileSize);
        
        try {
          // Validate file type with expanded support and fallback to extension
          const allowedVideoTypes = [
            'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 
            'video/x-msvideo', 'video/mpeg', 'video/3gpp', 'video/mov',
            'application/vnd.apple.mpegurl'
          ];
          const allowedImageTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 
            'image/gif', 'image/bmp', 'image/svg+xml'
          ];
          
          // Extract file extension for fallback validation
          const fileExtension = fileName.toLowerCase().split('.').pop() || '';
          const allowedVideoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mpeg', '3gp', 'm3u8'];
          const allowedImageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];
          
          console.log('[UPLOAD-VIDEO] File validation - Type:', fileType, 'Extension:', fileExtension, 'FileName:', fileName);
          
          // Determine if it's a video or image file
          const isVideoByType = allowedVideoTypes.includes(fileType);
          const isImageByType = allowedImageTypes.includes(fileType);
          const isVideoByExtension = allowedVideoExtensions.includes(fileExtension);
          const isImageByExtension = allowedImageExtensions.includes(fileExtension);
          
          // Use type first, fallback to extension if type is unknown
          const isVideo = isVideoByType || (!fileType && isVideoByExtension);
          const isImage = isImageByType || (!fileType && isImageByExtension);
          
          if (!isVideo && !isImage) {
            console.error('Invalid file type and extension:', { fileType, fileExtension, fileName });
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Invalid file type',
                details: `File "${fileName}" with type "${fileType}" and extension "${fileExtension}" is not supported. Supported video types: ${allowedVideoTypes.join(', ')}. Supported image types: ${allowedImageTypes.join(', ')}`
              }),
              { status: 400, headers: corsHeaders }
            );
          }
          
          const bucket = isVideo ? 'videos' : 'thumbnails';
          const maxSize = bucket === 'videos' ? 1073741824 : 10485760; // 1GB for videos, 10MB for thumbnails
          
          console.log('[UPLOAD-VIDEO] Determined bucket:', bucket, 'Max size:', maxSize, 'File validation:', { isVideo, isImage, fileType, fileExtension });

          if (fileSize > maxSize) {
            console.error('File too large:', fileSize, 'Max:', maxSize);
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB`,
                details: `File size: ${fileSize}, Max: ${maxSize}`
              }),
              { status: 400, headers: corsHeaders }
            );
          }

          // Generate unique file path
          const timestamp = Date.now();
          const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
          const filePath = `${timestamp}_${sanitizedFileName}`;
          
          console.log('[UPLOAD-VIDEO] Generated file path:', filePath);

          // Create signed upload URL
          console.log('[UPLOAD-VIDEO] Creating signed upload URL for bucket:', bucket);
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(bucket)
            .createSignedUploadUrl(filePath, {
              expiresIn: 3600, // 1 hour
            });

          if (uploadError) {
            console.error('Upload URL creation error:', uploadError);
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Failed to create upload URL',
                details: uploadError.message
              }),
              { status: 500, headers: corsHeaders }
            );
          }

          console.log('[UPLOAD-VIDEO] Successfully created upload URL');
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
        } catch (error) {
          console.error('Error in get_upload_info:', error);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Internal server error in get_upload_info',
              details: error.message
            }),
            { status: 500, headers: corsHeaders }
          );
        }
      }

      case 'confirm_upload': {
        console.log('[UPLOAD-VIDEO] Processing confirm_upload for:', filePath, 'in bucket:', bucket);
        
        try {
          // Verify the file was uploaded successfully
          const { data: fileData, error: fileError } = await supabase.storage
            .from(bucket)
            .list('', {
              limit: 1000
            });

          console.log('[UPLOAD-VIDEO] Files in bucket:', fileData?.length, 'files');
          
          const fileExists = fileData?.find(file => file.name === filePath);
          console.log('[UPLOAD-VIDEO] File exists check for', filePath, ':', fileExists ? 'YES' : 'NO');

          if (fileError || !fileExists) {
            console.error('File verification failed:', { fileError, filePath, foundFiles: fileData?.length });
            return new Response(
              JSON.stringify({ 
                success: false,
                error: 'File upload verification failed',
                details: fileError?.message || 'File not found in storage'
              }),
              { status: 400, headers: corsHeaders }
            );
          }

          // Get the public URL (for internal reference)
          const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

          console.log('[UPLOAD-VIDEO] File verification successful, returning URLs');
          return new Response(
            JSON.stringify({
              success: true,
              filePath: filePath,
              publicUrl: urlData.publicUrl
            }),
            { headers: corsHeaders }
          );
        } catch (error) {
          console.error('Error in confirm_upload:', error);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Internal server error in confirm_upload',
              details: error.message
            }),
            { status: 500, headers: corsHeaders }
          );
        }
      }

      default:
        console.error('Invalid action received:', action);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid action',
            details: `Action '${action}' is not supported. Valid actions: get_upload_info, confirm_upload`
          }),
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
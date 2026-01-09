import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { corsHeaders } from "../_shared/cors.ts";

const BUCKET_MAP: Record<string, string> = {
  thumbnail: 'thumbnails',
  landscape_poster: 'landscape-posters',
  slider_cover: 'slider-covers',
  video: 'videos',
  trailer: 'trailers',
};

const MAX_SIZES: Record<string, number> = {
  thumbnail: 5 * 1024 * 1024, // 5MB
  landscape_poster: 10 * 1024 * 1024, // 10MB
  slider_cover: 10 * 1024 * 1024, // 10MB
  video: 5 * 1024 * 1024 * 1024, // 5GB
  trailer: 500 * 1024 * 1024, // 500MB
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is super admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'super_admin') {
      throw new Error('Only super admins can upload content');
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'get_upload_info') {
      const { fileName, fileSize, fileType, mediaType } = body;

      if (!fileName || !fileSize || !fileType || !mediaType) {
        throw new Error('Missing required fields: fileName, fileSize, fileType, mediaType');
      }

      const bucket = BUCKET_MAP[mediaType];
      if (!bucket) {
        throw new Error(`Unsupported media type: ${mediaType}`);
      }

      // Validate file size
      const maxSize = MAX_SIZES[mediaType];
      if (fileSize > maxSize) {
        throw new Error(`File size exceeds maximum allowed (${maxSize} bytes)`);
      }

      // Validate file type
      const isImage = ['thumbnail', 'landscape_poster', 'slider_cover'].includes(mediaType);
      const allowedTypes = isImage ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
      
      if (!allowedTypes.includes(fileType)) {
        throw new Error(`File type ${fileType} not allowed for ${mediaType}`);
      }

      // Generate unique file path
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `content/${mediaType}/${timestamp}_${sanitizedFileName}`;

      // Generate signed upload URL
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(filePath);

      if (uploadError) {
        throw new Error(`Failed to create upload URL: ${uploadError.message}`);
      }

      return new Response(
        JSON.stringify({
          uploadUrl: uploadData.signedUrl,
          filePath: filePath,
          bucket: bucket,
          token: uploadData.token,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'confirm_upload') {
      const { filePath, bucket } = body;

      if (!filePath || !bucket) {
        throw new Error('Missing required fields: filePath, bucket');
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return new Response(
        JSON.stringify({
          publicUrl: urlData.publicUrl,
          filePath: filePath,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    console.error('Content upload error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

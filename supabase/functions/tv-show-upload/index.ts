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

    // Parse request body
    const requestBody = await req.json();
    console.log('[TV-SHOW-UPLOAD] Request:', { action: requestBody.action, contentType: requestBody.contentType });
    const { action, fileName, fileSize, fileType, filePath, bucket, contentType } = requestBody;

    switch (action) {
      case 'get_upload_info': {
        console.log('[TV-SHOW-UPLOAD] Processing TV show media upload:', fileName, fileType, fileSize);
        
        try {
          // Validate content type specific to TV shows
          if (!['poster', 'trailer', 'episode'].includes(contentType)) {
            return new Response(
              JSON.stringify({ 
                error: 'Invalid content type for TV show',
                details: `Content type '${contentType}' not supported. Valid types: poster, trailer, episode`
              }),
              { status: 400, headers: corsHeaders }
            );
          }

          // Define allowed types and sizes based on content type
          let allowedTypes: string[] = [];
          let maxSize = 0;
          let targetBucket = '';

          switch (contentType) {
            case 'poster':
              allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
              maxSize = 10 * 1024 * 1024; // 10MB
              targetBucket = 'thumbnails';
              break;
            case 'trailer':
            case 'episode':
              allowedTypes = [
                'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 
                'video/x-msvideo', 'video/mpeg', 'video/3gpp', 'video/mov'
              ];
              maxSize = contentType === 'trailer' ? 500 * 1024 * 1024 : 2 * 1024 * 1024 * 1024; // 500MB for trailers, 2GB for episodes
              targetBucket = 'videos';
              break;
          }

          // Enhanced file type validation
          const fileExtension = fileName.toLowerCase().split('.').pop() || '';
          const extensionMap: Record<string, string[]> = {
            poster: ['jpg', 'jpeg', 'png', 'webp'],
            trailer: ['mp4', 'webm', 'mov', 'avi'],
            episode: ['mp4', 'webm', 'mov', 'avi', 'mkv']
          };

          const validType = allowedTypes.includes(fileType) || 
                          extensionMap[contentType]?.includes(fileExtension);

          if (!validType) {
            return new Response(
              JSON.stringify({ 
                error: `Invalid file type for ${contentType}`,
                details: `File type '${fileType}' or extension '${fileExtension}' not allowed for ${contentType}`
              }),
              { status: 400, headers: corsHeaders }
            );
          }

          if (fileSize > maxSize) {
            return new Response(
              JSON.stringify({ 
                error: `File too large for ${contentType}`,
                details: `Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`
              }),
              { status: 400, headers: corsHeaders }
            );
          }

          // Generate TV show specific file path
          const timestamp = Date.now();
          const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
          const tvShowFilePath = `tv_shows/${contentType}/${timestamp}_${sanitizedFileName}`;
          
          console.log('[TV-SHOW-UPLOAD] Generated file path:', tvShowFilePath);

          // Create signed upload URL with TV show specific settings
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(targetBucket)
            .createSignedUploadUrl(tvShowFilePath, {
              expiresIn: 7200, // 2 hours for larger files
            });

          if (uploadError) {
            console.error('[TV-SHOW-UPLOAD] Upload URL creation error:', uploadError);
            return new Response(
              JSON.stringify({ 
                error: 'Failed to create upload URL',
                details: uploadError.message
              }),
              { status: 500, headers: corsHeaders }
            );
          }

          console.log('[TV-SHOW-UPLOAD] Successfully created upload URL');
          return new Response(
            JSON.stringify({
              uploadUrl: uploadData.signedUrl,
              filePath: tvShowFilePath,
              bucket: targetBucket,
              token: uploadData.token,
              contentType: contentType
            }),
            { headers: corsHeaders }
          );
        } catch (error) {
          console.error('[TV-SHOW-UPLOAD] Error in get_upload_info:', error);
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
        console.log('[TV-SHOW-UPLOAD] Processing confirm_upload for:', filePath, 'in bucket:', bucket);
        
        try {
          // Verify the file was uploaded successfully
          const { data: fileData, error: fileError } = await supabase.storage
            .from(bucket)
            .list('tv_shows/', {
              limit: 1000
            });

          console.log('[TV-SHOW-UPLOAD] Files in TV shows folder:', fileData?.length);
          
          // Check for file in nested structure
          const fileName = filePath.split('/').pop();
          const fileExists = fileData?.find(file => 
            file.name === fileName || file.name === filePath.split('/').slice(-1)[0]
          );
          
          console.log('[TV-SHOW-UPLOAD] File exists check:', fileExists ? 'YES' : 'NO');

          if (fileError || !fileExists) {
            // Also check root level for fallback
            const { data: rootData } = await supabase.storage
              .from(bucket)
              .list('', { limit: 1000 });
            
            const rootFileExists = rootData?.find(file => file.name === filePath);
            
            if (!rootFileExists) {
              console.error('[TV-SHOW-UPLOAD] File verification failed:', { fileError, filePath });
              return new Response(
                JSON.stringify({ 
                  error: 'File upload verification failed',
                  details: fileError?.message || 'File not found in storage'
                }),
                { status: 400, headers: corsHeaders }
              );
            }
          }

          // Get the public URL
          const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

          console.log('[TV-SHOW-UPLOAD] File verification successful');
          return new Response(
            JSON.stringify({
              filePath: filePath,
              publicUrl: urlData.publicUrl,
              bucket: bucket
            }),
            { headers: corsHeaders }
          );
        } catch (error) {
          console.error('[TV-SHOW-UPLOAD] Error in confirm_upload:', error);
          return new Response(
            JSON.stringify({ 
              error: 'Internal server error in confirm_upload',
              details: error.message
            }),
            { status: 500, headers: corsHeaders }
          );
        }
      }

      case 'bulk_episode_upload': {
        console.log('[TV-SHOW-UPLOAD] Processing bulk episode upload');
        
        try {
          const { episodes, seasonId } = requestBody;
          
          if (!episodes || !Array.isArray(episodes) || !seasonId) {
            return new Response(
              JSON.stringify({ 
                error: 'Invalid bulk upload data',
                details: 'Episodes array and seasonId are required'
              }),
              { status: 400, headers: corsHeaders }
            );
          }

          const uploadResults = [];
          
          for (const episode of episodes) {
            try {
              // Validate episode data
              if (!episode.title || !episode.episode_number) {
                uploadResults.push({
                  episode_number: episode.episode_number,
                  success: false,
                  error: 'Missing required fields'
                });
                continue;
              }

              // Insert episode into database
              const { data: episodeData, error: episodeError } = await supabase
                .from('episodes')
                .insert({
                  season_id: seasonId,
                  title: episode.title,
                  episode_number: episode.episode_number,
                  duration: episode.duration || null,
                  price: episode.price || 0,
                  rental_expiry_duration: episode.rental_expiry_duration || 48,
                  video_url: episode.video_url || null,
                  release_date: episode.release_date || null,
                  status: 'pending'
                })
                .select()
                .single();

              if (episodeError) {
                uploadResults.push({
                  episode_number: episode.episode_number,
                  success: false,
                  error: episodeError.message
                });
              } else {
                uploadResults.push({
                  episode_number: episode.episode_number,
                  success: true,
                  episode_id: episodeData.id
                });
              }
            } catch (error) {
              uploadResults.push({
                episode_number: episode.episode_number,
                success: false,
                error: error.message
              });
            }
          }

          return new Response(
            JSON.stringify({
              results: uploadResults,
              total: episodes.length,
              successful: uploadResults.filter(r => r.success).length,
              failed: uploadResults.filter(r => !r.success).length
            }),
            { headers: corsHeaders }
          );
        } catch (error) {
          console.error('[TV-SHOW-UPLOAD] Error in bulk_episode_upload:', error);
          return new Response(
            JSON.stringify({ 
              error: 'Internal server error in bulk_episode_upload',
              details: error.message
            }),
            { status: 500, headers: corsHeaders }
          );
        }
      }

      default:
        console.error('[TV-SHOW-UPLOAD] Invalid action received:', action);
        return new Response(
          JSON.stringify({ 
            error: 'Invalid action',
            details: `Action '${action}' is not supported. Valid actions: get_upload_info, confirm_upload, bulk_episode_upload`
          }),
          { status: 400, headers: corsHeaders }
        );
    }

  } catch (error) {
    console.error('[TV-SHOW-UPLOAD] Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
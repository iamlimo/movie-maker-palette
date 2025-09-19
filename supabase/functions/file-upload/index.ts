import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'
import { corsHeaders } from '../_shared/cors.ts'

const corsHeadersExtended = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const BUCKET_MAPPINGS = {
  'video': 'videos',
  'trailer': 'videos',
  'thumbnail': 'thumbnails',
  'landscape_poster': 'landscape-posters',
  'slider_cover': 'slider-covers',
  'tv_show_poster': 'tv-show-posters',
  'tv_trailer': 'tv-trailers',
  'episode_video': 'tv-episodes',
  'episode_thumbnail': 'episode-thumbnails',
  'poster': 'tv-show-posters',
  'episode': 'tv-episodes'
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeadersExtended })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: corsHeadersExtended
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: corsHeadersExtended
      })
    }

    if (req.method === 'POST') {
      const url = new URL(req.url)
      const fileType = url.searchParams.get('type') // video, thumbnail, etc.
      const fileName = url.searchParams.get('filename')
      
      // For direct file uploads without query params, try to infer from content type
      let inferredFileType = fileType;
      let inferredFileName = fileName;
      
      if (!fileType || !fileName) {
        const contentType = req.headers.get('content-type') || '';
        if (contentType.startsWith('image/')) {
          inferredFileType = 'poster';
        } else if (contentType.startsWith('video/')) {
          inferredFileType = 'trailer';
        }
        inferredFileName = `file-${Date.now()}${contentType.includes('jpeg') ? '.jpg' : contentType.includes('png') ? '.png' : contentType.includes('mp4') ? '.mp4' : ''}`;
      }
      
      if (!inferredFileType) {
        return new Response(JSON.stringify({ error: 'File type could not be determined' }), {
          status: 400,
          headers: corsHeadersExtended
        })
      }

      const bucket = BUCKET_MAPPINGS[inferredFileType as keyof typeof BUCKET_MAPPINGS]
      if (!bucket) {
        return new Response(JSON.stringify({ error: `Invalid file type: ${inferredFileType}` }), {
          status: 400,
          headers: corsHeadersExtended
        })
      }

      // Generate unique file path
      const timestamp = Date.now()
      const uniqueFileName = `${timestamp}-${inferredFileName}`
      const filePath = `${user.id}/${uniqueFileName}`

      try {
        // Get file data from request
        const fileData = await req.arrayBuffer()
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, fileData, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          return new Response(JSON.stringify({ error: 'Upload failed', details: uploadError.message }), {
            status: 500,
            headers: corsHeadersExtended
          })
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath)

        return new Response(JSON.stringify({
          success: true,
          url: urlData.publicUrl,
          filePath: filePath,
          bucket: bucket
        }), {
          headers: corsHeadersExtended
        })

      } catch (error) {
        console.error('File processing error:', error)
        return new Response(JSON.stringify({ error: 'File processing failed' }), {
          status: 500,
          headers: corsHeadersExtended
        })
      }
    }

    // Handle GET requests for signed URLs
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const action = url.searchParams.get('action')
      const fileType = url.searchParams.get('type')
      const fileName = url.searchParams.get('filename')

      if (action === 'signed-url' && fileType && fileName) {
        const bucket = BUCKET_MAPPINGS[fileType as keyof typeof BUCKET_MAPPINGS]
        if (!bucket) {
          return new Response(JSON.stringify({ error: 'Invalid file type' }), {
            status: 400,
            headers: corsHeadersExtended
          })
        }

        const timestamp = Date.now()
        const uniqueFileName = `${timestamp}-${fileName}`
        const filePath = `${user.id}/${uniqueFileName}`

        try {
          const { data: signedData, error: signedError } = await supabase.storage
            .from(bucket)
            .createSignedUploadUrl(filePath)

          if (signedError) {
            console.error('Signed URL error:', signedError)
            return new Response(JSON.stringify({ error: 'Failed to create signed URL' }), {
              status: 500,
              headers: corsHeadersExtended
            })
          }

          return new Response(JSON.stringify({
            success: true,
            signedUrl: signedData.signedUrl,
            filePath: filePath,
            bucket: bucket
          }), {
            headers: corsHeadersExtended
          })

        } catch (error) {
          console.error('Signed URL processing error:', error)
          return new Response(JSON.stringify({ error: 'Signed URL processing failed' }), {
            status: 500,
            headers: corsHeadersExtended
          })
        }
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeadersExtended
    })

  } catch (error) {
    console.error('File upload error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeadersExtended
    })
  }
})
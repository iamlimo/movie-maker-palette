import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Authenticate user
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('Authentication failed:', authError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized',
          details: authError?.message || 'No user found'
        }),
        { status: 401, headers: corsHeaders }
      )
    }

    // Check if user is super admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      console.error('User is not super admin:', user.id, 'role:', userRole?.role)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Forbidden: Super admin access required',
          details: `Current role: ${userRole?.role || 'none'}`
        }),
        { status: 403, headers: corsHeaders }
      )
    }

    const { fileName, fileType, contentType } = await req.json()

    console.log('Processing upload request:', { fileName, fileType, contentType })

    // Determine bucket based on file type and content type
    let bucketName: string
    switch (fileType) {
      case 'video':
        bucketName = 'videos'
        break
      case 'thumbnail':
        bucketName = 'thumbnails'
        break
      case 'poster':
      case 'banner':
        bucketName = 'tv-show-posters'
        break
      case 'trailer':
        // Check if this is for TV shows or movies based on contentType
        bucketName = contentType?.includes('tv') || contentType?.includes('show') ? 'tv-trailers' : 'trailers'
        break
      case 'episode-video':
        bucketName = 'videos'
        break
      case 'episode-thumbnail':
        bucketName = 'thumbnails'
        break
      case 'episode-trailer':
        bucketName = 'tv-trailers'
        break
      default:
        throw new Error(`Invalid file type: ${fileType}`)
    }

    // Generate unique file path
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = fileName.split('.').pop()
    const uniqueFileName = `${timestamp}_${randomId}.${fileExtension}`

    // Create signed URL for upload
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from(bucketName)
      .createSignedUploadUrl(uniqueFileName)

    if (signedUrlError) {
      console.error('Failed to create signed URL:', signedUrlError)
      throw signedUrlError
    }

    console.log('Created signed URL for upload:', { bucketName, uniqueFileName })

    return new Response(
      JSON.stringify({
        success: true,
        uploadUrl: signedUrlData.signedUrl,
        filePath: uniqueFileName,
        bucket: bucketName,
        publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucketName}/${uniqueFileName}`
      }),
      { headers: corsHeaders }
    )

  } catch (error) {
    console.error('Upload URL generation failed:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to generate upload URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
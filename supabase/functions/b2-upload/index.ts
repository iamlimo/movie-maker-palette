import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface B2AuthResponse {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
}

interface B2UploadResponse {
  fileId: string;
  fileName: string;
  accountId: string;
  bucketId: string;
  fileUrl: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Get user session
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Check if user is super admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      throw new Error('Access denied - Super Admin required')
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const fileName = formData.get('fileName') as string
    const bucketType = formData.get('bucketType') as string || 'movies'

    if (!file) {
      throw new Error('No file provided')
    }

    // Get B2 credentials
    const applicationKeyId = Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY_ID')
    const applicationKey = Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY')
    const bucketName = Deno.env.get('BACKBLAZE_B2_BUCKET_NAME')

    if (!applicationKeyId || !applicationKey || !bucketName) {
      throw new Error('B2 credentials not configured')
    }

    // Authenticate with B2
    const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(`${applicationKeyId}:${applicationKey}`)}`
      }
    })

    if (!authResponse.ok) {
      throw new Error('B2 authentication failed')
    }

    const authData: B2AuthResponse = await authResponse.json()

    // Get upload URL
    const uploadUrlResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: 'POST',
      headers: {
        'Authorization': authData.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketId: bucketName
      })
    })

    if (!uploadUrlResponse.ok) {
      throw new Error('Failed to get upload URL')
    }

    const uploadUrlData = await uploadUrlResponse.json()

    // Upload file
    const fileBytes = new Uint8Array(await file.arrayBuffer())
    const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': uploadUrlData.authorizationToken,
        'X-Bz-File-Name': fileName || file.name,
        'Content-Type': file.type || 'application/octet-stream',
        'X-Bz-Content-Sha1': 'unverified'
      },
      body: fileBytes
    })

    if (!uploadResponse.ok) {
      throw new Error('File upload failed')
    }

    const uploadData: B2UploadResponse = await uploadResponse.json()

    // Generate download URL
    const downloadUrl = `${authData.downloadUrl}/file/${bucketName}/${uploadData.fileName}`

    console.log('File uploaded successfully:', {
      fileId: uploadData.fileId,
      fileName: uploadData.fileName,
      downloadUrl
    })

    return new Response(
      JSON.stringify({
        success: true,
        fileId: uploadData.fileId,
        fileName: uploadData.fileName,
        downloadUrl,
        message: 'File uploaded successfully'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Upload error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

interface B2AuthResponse {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
  accountId: string;
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

  // Set timeout for the entire request
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minutes

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

    // Validate file size (100MB limit)
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxFileSize) {
      throw new Error(`File too large. Maximum size is ${maxFileSize / (1024 * 1024)}MB`)
    }

    // Get B2 credentials
    const applicationKeyId = Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY_ID')
    const applicationKey = Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY')
    const bucketName = Deno.env.get('BACKBLAZE_B2_BUCKET_NAME')

    console.log('B2 Upload - Starting upload process', {
      applicationKeyId: applicationKeyId ? 'present' : 'missing',
      applicationKey: applicationKey ? 'present' : 'missing',
      bucketName: bucketName ? 'present' : 'missing',
      fileName: fileName || file.name,
      fileSize: file.size,
      fileType: file.type
    })

    if (!applicationKeyId || !applicationKey || !bucketName) {
      const missingCreds = []
      if (!applicationKeyId) missingCreds.push('APPLICATION_KEY_ID')
      if (!applicationKey) missingCreds.push('APPLICATION_KEY')  
      if (!bucketName) missingCreds.push('BUCKET_NAME')
      
      console.error('B2 Upload - Missing credentials:', missingCreds)
      throw new Error(`B2 credentials not configured: ${missingCreds.join(', ')}`)
    }

    // Authenticate with B2
    console.log('B2 Upload - Authenticating with B2...')
    const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(`${applicationKeyId}:${applicationKey}`)}`
      },
      signal: controller.signal
    })

    if (!authResponse.ok) {
      const authError = await authResponse.text()
      console.error('B2 Upload - Authentication failed:', authError)
      throw new Error(`B2 authentication failed: ${authError}`)
    }

    const authData: B2AuthResponse = await authResponse.json()
    console.log('B2 Upload - Authentication successful')

    // Get list of buckets to find the correct bucket ID
    console.log('B2 Upload - Getting bucket list...')
    const bucketsResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_list_buckets`, {
      method: 'POST',
      headers: {
        'Authorization': authData.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountId: authData.accountId
      }),
      signal: controller.signal
    })

    if (!bucketsResponse.ok) {
      const bucketError = await bucketsResponse.text()
      console.error('B2 Upload - Failed to get bucket list:', bucketError)
      throw new Error(`Failed to get bucket list: ${bucketError}`)
    }

    const bucketsData = await bucketsResponse.json()
    const bucket = bucketsData.buckets.find((b: any) => b.bucketName === bucketName)
    
    if (!bucket) {
      console.error('B2 Upload - Bucket not found:', bucketName, 'Available buckets:', bucketsData.buckets.map((b: any) => b.bucketName))
      throw new Error(`Bucket '${bucketName}' not found`)
    }

    const bucketId = bucket.bucketId
    console.log('B2 Upload - Found bucket ID:', bucketId)

    // Get upload URL
    console.log('B2 Upload - Getting upload URL...')
    const uploadUrlResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: 'POST',
      headers: {
        'Authorization': authData.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketId: bucketId
      }),
      signal: controller.signal
    })

    if (!uploadUrlResponse.ok) {
      const uploadUrlError = await uploadUrlResponse.text()
      console.error('B2 Upload - Failed to get upload URL:', uploadUrlError)
      throw new Error(`Failed to get upload URL: ${uploadUrlError}`)
    }

    const uploadUrlData = await uploadUrlResponse.json()
    console.log('B2 Upload - Got upload URL successfully')

    // Upload file
    console.log('B2 Upload - Starting file upload...')
    const fileBytes = new Uint8Array(await file.arrayBuffer())
    const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': uploadUrlData.authorizationToken,
        'X-Bz-File-Name': fileName || file.name,
        'Content-Type': file.type || 'application/octet-stream',
        'X-Bz-Content-Sha1': 'unverified'
      },
      body: fileBytes,
      signal: controller.signal
    })

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.text()
      console.error('B2 Upload - File upload failed:', uploadError)
      throw new Error(`File upload failed: ${uploadError}`)
    }

    const uploadData: B2UploadResponse = await uploadResponse.json()
    console.log('B2 Upload - File uploaded successfully')

    // Generate download URL
    const downloadUrl = `${authData.downloadUrl}/file/${bucketName}/${uploadData.fileName}`

    console.log('File uploaded successfully:', {
      fileId: uploadData.fileId,
      fileName: uploadData.fileName,
      downloadUrl
    })

    // Clear timeout on success
    clearTimeout(timeoutId)

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
    // Clear timeout on error
    clearTimeout(timeoutId)
    
    console.error('Upload error:', error)
    
    // Handle timeout errors specifically
    if (error.name === 'AbortError') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Upload timeout - file too large or network issues'
        }),
        { 
          status: 408,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Upload failed'
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
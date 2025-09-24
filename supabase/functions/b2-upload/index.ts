import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

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

// Helper function to authenticate with B2
async function authenticateB2() {
  const applicationKeyId = Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY_ID')
  const applicationKey = Deno.env.get('BACKBLAZE_B2_APPLICATION_KEY')
  
  if (!applicationKeyId || !applicationKey) {
    throw new Error('B2 credentials not configured')
  }

  const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${btoa(`${applicationKeyId}:${applicationKey}`)}`
    }
  })

  if (!authResponse.ok) {
    const authError = await authResponse.text()
    throw new Error(`B2 authentication failed: ${authError}`)
  }

  return await authResponse.json() as B2AuthResponse
}

// Helper function to get bucket ID
async function getBucketId(authData: B2AuthResponse) {
  const bucketName = Deno.env.get('BACKBLAZE_B2_BUCKET_NAME')
  if (!bucketName) {
    throw new Error('Bucket name not configured')
  }

  const bucketsResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_list_buckets`, {
    method: 'POST',
    headers: {
      'Authorization': authData.authorizationToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      accountId: authData.accountId
    })
  })

  if (!bucketsResponse.ok) {
    const bucketError = await bucketsResponse.text()
    throw new Error(`Failed to get bucket list: ${bucketError}`)
  }

  const bucketsData = await bucketsResponse.json()
  const bucket = bucketsData.buckets.find((b: any) => b.bucketName === bucketName)
  
  if (!bucket) {
    throw new Error(`Bucket '${bucketName}' not found`)
  }

  return bucket.bucketId
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

    // Get user session and verify super admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      throw new Error('Access denied - Super Admin required')
    }

    const requestData = await req.json()
    const { action, fileName, fileSize, fileType, fileId, partNumber, uploadId } = requestData

    console.log('B2 Upload Action:', action, { fileName, fileSize, fileType })

    // Authenticate with B2 and get bucket ID
    const authData = await authenticateB2()
    const bucketId = await getBucketId(authData)

    switch (action) {
      case 'get_upload_info': {
        // Determine upload strategy based on file size
        const isLargeFile = fileSize > 100 * 1024 * 1024 // 100MB threshold
        
        if (isLargeFile) {
          // Start large file session
          console.log('Starting large file upload session...')
          const startResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_start_large_file`, {
            method: 'POST',
            headers: {
              'Authorization': authData.authorizationToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              bucketId,
              fileName,
              contentType: fileType || 'application/octet-stream'
            })
          })

          if (!startResponse.ok) {
            const error = await startResponse.text()
            throw new Error(`Failed to start large file: ${error}`)
          }

          const startData = await startResponse.json()
          return new Response(
            JSON.stringify({
              success: true,
              uploadType: 'chunked',
              fileId: startData.fileId,
              uploadId: startData.fileId, // For compatibility
              chunkSize: 10 * 1024 * 1024 // 10MB chunks
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          // Get upload URL for small file
          console.log('Getting upload URL for small file...')
          const uploadUrlResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_url`, {
            method: 'POST',
            headers: {
              'Authorization': authData.authorizationToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bucketId })
          })

          if (!uploadUrlResponse.ok) {
            const error = await uploadUrlResponse.text()
            throw new Error(`Failed to get upload URL: ${error}`)
          }

          const uploadUrlData = await uploadUrlResponse.json()
          return new Response(
            JSON.stringify({
              success: true,
              uploadType: 'direct',
              uploadUrl: uploadUrlData.uploadUrl,
              authorizationToken: uploadUrlData.authorizationToken,
              fileName
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      case 'get_upload_part_url': {
        // Get upload URL for a specific part of a large file
        console.log(`Getting upload part URL for part ${partNumber}...`)
        const partUrlResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_part_url`, {
          method: 'POST',
          headers: {
            'Authorization': authData.authorizationToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fileId })
        })

        if (!partUrlResponse.ok) {
          const error = await partUrlResponse.text()
          throw new Error(`Failed to get upload part URL: ${error}`)
        }

        const partUrlData = await partUrlResponse.json()
        return new Response(
          JSON.stringify({
            success: true,
            uploadUrl: partUrlData.uploadUrl,
            authorizationToken: partUrlData.authorizationToken
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'finish_large_file': {
        // Finalize the large file upload
        const { partSha1Array } = requestData
        console.log('Finishing large file upload...')
        
        const finishResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_finish_large_file`, {
          method: 'POST',
          headers: {
            'Authorization': authData.authorizationToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileId,
            partSha1Array
          })
        })

        if (!finishResponse.ok) {
          const error = await finishResponse.text()
          throw new Error(`Failed to finish large file: ${error}`)
        }

        const finishData = await finishResponse.json()
        const bucketName = Deno.env.get('BACKBLAZE_B2_BUCKET_NAME')
        const downloadUrl = `${authData.downloadUrl}/file/${bucketName}/${finishData.fileName}`

        return new Response(
          JSON.stringify({
            success: true,
            fileId: finishData.fileId,
            fileName: finishData.fileName,
            downloadUrl,
            message: 'Large file uploaded successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }

  } catch (error) {
    console.error('B2 Upload error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
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
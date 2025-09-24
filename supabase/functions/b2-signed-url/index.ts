import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Get user session for authorization
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { fileName, expiryHours = 48 } = await req.json()

    if (!fileName) {
      throw new Error('fileName is required')
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

    const authData = await authResponse.json()

    // Calculate expiry timestamp (in seconds)
    const expiryTimestamp = Math.floor(Date.now() / 1000) + (expiryHours * 3600)

    // Generate signed download URL
    const signedUrlResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_download_authorization`, {
      method: 'POST',
      headers: {
        'Authorization': authData.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketId: bucketName,
        fileNamePrefix: fileName,
        validDurationInSeconds: expiryHours * 3600
      })
    })

    if (!signedUrlResponse.ok) {
      throw new Error('Failed to generate signed URL')
    }

    const signedData = await signedUrlResponse.json()
    const signedUrl = `${authData.downloadUrl}/file/${bucketName}/${fileName}?Authorization=${signedData.authorizationToken}`

    console.log('Signed URL generated:', {
      fileName,
      expiryHours,
      expiryTimestamp
    })

    return new Response(
      JSON.stringify({
        success: true,
        signedUrl,
        expiresAt: new Date(expiryTimestamp * 1000).toISOString(),
        message: 'Signed URL generated successfully'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Signed URL error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
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
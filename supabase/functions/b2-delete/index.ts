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

    const { fileName, fileId } = await req.json()

    if (!fileName && !fileId) {
      throw new Error('fileName or fileId is required')
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

    let targetFileId = fileId

    // If we only have fileName, find the fileId
    if (!targetFileId && fileName) {
      const listResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_list_file_names`, {
        method: 'POST',
        headers: {
          'Authorization': authData.authorizationToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bucketId: bucketName,
          startFileName: fileName,
          maxFileCount: 1
        })
      })

      if (!listResponse.ok) {
        throw new Error('Failed to find file')
      }

      const listData = await listResponse.json()
      const file = listData.files.find((f: any) => f.fileName === fileName)
      
      if (!file) {
        throw new Error('File not found')
      }

      targetFileId = file.fileId
    }

    // Delete file
    const deleteResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_delete_file_version`, {
      method: 'POST',
      headers: {
        'Authorization': authData.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileId: targetFileId,
        fileName: fileName
      })
    })

    if (!deleteResponse.ok) {
      throw new Error('Failed to delete file')
    }

    console.log('File deleted successfully:', {
      fileId: targetFileId,
      fileName
    })

    return new Response(
      JSON.stringify({
        success: true,
        fileId: targetFileId,
        fileName,
        message: 'File deleted successfully'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Delete error:', error)
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
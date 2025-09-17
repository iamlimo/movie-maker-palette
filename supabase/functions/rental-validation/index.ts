import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'
import { corsHeaders } from '../_shared/cors.ts'

const corsHeadersExtended = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
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

    const url = new URL(req.url)
    const contentId = url.searchParams.get('content_id')
    const contentType = url.searchParams.get('content_type')

    if (!contentId || !contentType) {
      return new Response(JSON.stringify({ error: 'Content ID and type required' }), {
        status: 400,
        headers: corsHeadersExtended
      })
    }

    // Check for active rental
    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .select('*')
      .eq('user_id', user.id)
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle()

    if (rentalError) {
      console.error('Rental check error:', rentalError)
      return new Response(JSON.stringify({ error: 'Failed to check rental status' }), {
        status: 500,
        headers: corsHeadersExtended
      })
    }

    const hasAccess = !!rental
    let videoUrl = null

    if (hasAccess && contentType === 'movie') {
      // Get video URL for movie
      const { data: movie } = await supabase
        .from('movies')
        .select('video_url')
        .eq('id', contentId)
        .single()
      
      videoUrl = movie?.video_url
    } else if (hasAccess && contentType === 'episode') {
      // Get video URL for episode
      const { data: episode } = await supabase
        .from('episodes')
        .select('video_url')
        .eq('id', contentId)
        .single()
      
      videoUrl = episode?.video_url
    }

    return new Response(JSON.stringify({
      hasAccess,
      rental: hasAccess ? {
        id: rental.id,
        expires_at: rental.expires_at,
        amount: rental.amount
      } : null,
      videoUrl: hasAccess ? videoUrl : null
    }), {
      headers: corsHeadersExtended
    })

  } catch (error) {
    console.error('Rental validation error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeadersExtended
    })
  }
})
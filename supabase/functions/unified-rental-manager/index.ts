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
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'check'

    console.log('Rental manager request:', { action, userId: user.id })

    if (action === 'check') {
      const { contentId, contentType } = await req.json()
      return await checkRentalAccess(supabase, user.id, contentId, contentType)
    } else if (action === 'create') {
      const { contentId, contentType, amount, duration } = await req.json()
      return await createRental(supabase, user.id, contentId, contentType, amount, duration)
    } else if (action === 'validate') {
      const { contentId, contentType } = await req.json()
      return await validateAndGetVideoUrl(supabase, user.id, contentId, contentType)
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: corsHeaders }
    )

  } catch (error) {
    console.error('Rental management failed:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Rental management failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})

async function checkRentalAccess(supabase: any, userId: string, contentId: string, contentType: string) {
  try {
    console.log('Checking rental access:', { userId, contentId, contentType })

    const { data: rental, error } = await supabase
      .from('rentals')
      .select('*')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Database error checking rental:', error)
      throw error
    }

    const hasAccess = !!rental
    console.log('Rental access check result:', { hasAccess, rental: rental?.id })

    return new Response(
      JSON.stringify({ 
        hasAccess,
        rental: rental || null,
        expiresAt: rental?.expires_at || null
      }),
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Failed to check rental access:', error)
    throw error
  }
}

async function createRental(supabase: any, userId: string, contentId: string, contentType: string, amount: number, duration: number) {
  try {
    console.log('Creating rental:', { userId, contentId, contentType, amount, duration })

    // Check if user already has active rental
    const { data: existingRental } = await supabase
      .from('rentals')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .single()

    if (existingRental) {
      console.log('User already has active rental:', existingRental.id)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'User already has an active rental for this content'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + duration)

    const rentalData = {
      user_id: userId,
      content_id: contentId,
      content_type: contentType,
      amount: amount,
      expires_at: expiresAt.toISOString(),
      status: 'active'
    }

    const { data: rental, error } = await supabase
      .from('rentals')
      .insert(rentalData)
      .select()
      .single()

    if (error) {
      console.error('Database error creating rental:', error)
      throw error
    }

    console.log('Rental created successfully:', rental.id)

    return new Response(
      JSON.stringify({ 
        success: true,
        rental,
        message: 'Rental created successfully'
      }),
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Failed to create rental:', error)
    throw error
  }
}

async function validateAndGetVideoUrl(supabase: any, userId: string, contentId: string, contentType: string) {
  try {
    console.log('Validating access and getting video URL:', { userId, contentId, contentType })

    // Check rental access
    const { data: rental } = await supabase
      .from('rentals')
      .select('*')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .single()

    if (!rental) {
      console.log('No valid rental found for user')
      return new Response(
        JSON.stringify({ 
          hasAccess: false,
          error: 'No valid rental found'
        }),
        { status: 403, headers: corsHeaders }
      )
    }

    // Get content and video URL
    let videoUrl: string | null = null
    
    if (contentType === 'movie') {
      const { data: movie } = await supabase
        .from('movies')
        .select('video_url')
        .eq('id', contentId)
        .single()
      videoUrl = movie?.video_url
    } else if (contentType === 'episode') {
      const { data: episode } = await supabase
        .from('episodes')
        .select('video_url')
        .eq('id', contentId)
        .single()
      videoUrl = episode?.video_url
    }

    if (!videoUrl) {
      console.error('Video URL not found for content')
      return new Response(
        JSON.stringify({ 
          hasAccess: false,
          error: 'Video not available'
        }),
        { status: 404, headers: corsHeaders }
      )
    }

    console.log('Access validated, returning video URL')

    return new Response(
      JSON.stringify({ 
        hasAccess: true,
        videoUrl,
        rental,
        expiresAt: rental.expires_at
      }),
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Failed to validate access:', error)
    throw error
  }
}
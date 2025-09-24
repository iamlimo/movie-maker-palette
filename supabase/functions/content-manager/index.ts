import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'
import { corsHeaders } from '../_shared/cors.ts'

const corsHeadersExtended = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

interface ContentData {
  title: string
  description: string
  genre_id?: string
  release_date?: string
  duration?: number
  language?: string
  rating?: string
  price: number
  rental_expiry_duration?: number
  thumbnail_url?: string
  video_url?: string
  trailer_url?: string
  landscape_poster_url?: string
  slider_cover_url?: string
}

interface EpisodeData extends ContentData {
  season_id: string
  episode_number: number
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

    // Check if user is super admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: corsHeadersExtended
      })
    }

    const url = new URL(req.url)
    const contentType = url.searchParams.get('type') // 'movie', 'tv_show', or 'episode'

    if (req.method === 'POST') {
      const body = await req.json()
      
      let result
      
      switch (contentType) {
        case 'movie':
          result = await createMovie(supabase, body, user.id)
          break
        case 'tv_show':
          result = await createTVShow(supabase, body, user.id)
          break
        case 'episode':
          result = await createEpisode(supabase, body, user.id)
          break
        default:
          return new Response(JSON.stringify({ error: 'Invalid content type' }), {
            status: 400,
            headers: corsHeadersExtended
          })
      }

      return new Response(JSON.stringify(result), {
        headers: corsHeadersExtended
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeadersExtended
    })

  } catch (error) {
    console.error('Content manager error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeadersExtended
    })
  }
})

async function createMovie(supabase: any, data: ContentData, userId: string) {
  try {
    const { data: movie, error } = await supabase
      .from('movies')
      .insert({
        title: data.title,
        description: data.description,
        genre_id: data.genre_id,
        release_date: data.release_date,
        duration: data.duration ? parseInt(data.duration.toString()) : null,
        language: data.language,
        rating: data.rating,
        price: parseFloat(data.price.toString()),
        rental_expiry_duration: data.rental_expiry_duration ? parseInt(data.rental_expiry_duration.toString()) : 48,
        thumbnail_url: data.thumbnail_url,
        video_url: data.video_url,
        trailer_url: data.trailer_url,
        landscape_poster_url: data.landscape_poster_url,
        slider_cover_url: data.slider_cover_url,
        uploaded_by: userId,
        status: 'approved'
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: movie }
  } catch (error) {
    console.error('Create movie error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function createTVShow(supabase: any, data: ContentData, userId: string) {
  try {
    const { data: tvShow, error } = await supabase
      .from('tv_shows')
      .insert({
        title: data.title,
        description: data.description,
        genre_id: data.genre_id,
        release_date: data.release_date,
        language: data.language,
        rating: data.rating,
        price: parseFloat(data.price.toString()),
        thumbnail_url: data.thumbnail_url,
        landscape_poster_url: data.landscape_poster_url,
        slider_cover_url: data.slider_cover_url,
        uploaded_by: userId,
        status: 'approved'
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: tvShow }
  } catch (error) {
    console.error('Create TV show error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function createEpisode(supabase: any, data: EpisodeData, userId: string) {
  try {
    const { data: episode, error } = await supabase
      .from('episodes')
      .insert({
        season_id: data.season_id,
        episode_number: data.episode_number,
        title: data.title,
        duration: data.duration ? parseInt(data.duration.toString()) : null,
        release_date: data.release_date,
        price: parseFloat(data.price.toString()),
        rental_expiry_duration: data.rental_expiry_duration ? parseInt(data.rental_expiry_duration.toString()) : 48,
        video_url: data.video_url,
        status: 'approved'
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: episode }
  } catch (error) {
    console.error('Create episode error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
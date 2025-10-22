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

    // Check if user is super admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      console.error('User is not super admin:', user.id)
      return new Response(
        JSON.stringify({ error: 'Forbidden: Super admin access required' }),
        { status: 403, headers: corsHeaders }
      )
    }

    const url = new URL(req.url)
    const contentType = url.searchParams.get('type') || 'movie'
    const method = req.method

    console.log('Content manager request:', { method, contentType })

    if (method === 'POST') {
      const contentData = await req.json()
      console.log('Creating content:', { contentType, contentData })

      if (contentType === 'movie') {
        return await createMovie(supabase, contentData, user.id)
      } else if (contentType === 'tv_show') {
        return await createTVShow(supabase, contentData, user.id)
      } else if (contentType === 'season') {
        return await createSeason(supabase, contentData, user.id)
      } else if (contentType === 'episode') {
        return await createEpisode(supabase, contentData, user.id)
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { status: 400, headers: corsHeaders }
    )

  } catch (error) {
    console.error('Content management failed:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Content management failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})

async function createMovie(supabase: any, data: any, userId: string) {
  try {
    const movieData = {
      title: data.title,
      description: data.description,
      price: data.price,
      genre_id: data.genre_id,
      language: data.language,
      rating: data.rating,
      age_restriction: data.age_restriction || null,
      content_warnings: data.content_warnings || null,
      viewer_discretion: data.viewer_discretion || null,
      cast_info: data.cast_info || null,
      director: data.director || null,
      production_company: data.production_company || null,
      duration: data.duration,
      release_date: data.release_date,
      rental_expiry_duration: data.rental_expiry_duration || 48,
      video_url: data.video_url,
      thumbnail_url: data.thumbnail_url,
      trailer_url: data.trailer_url,
      landscape_poster_url: data.landscape_poster_url,
      slider_cover_url: data.slider_cover_url,
      status: 'approved', // Instantly available
      uploaded_by: userId
    }

    const { data: movie, error } = await supabase
      .from('movies')
      .insert(movieData)
      .select()
      .single()

    if (error) {
      console.error('Database error creating movie:', error)
      throw error
    }

    console.log('Movie created successfully:', movie.id)

    return new Response(
      JSON.stringify({ success: true, movie }),
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Failed to create movie:', error)
    throw error
  }
}

async function createTVShow(supabase: any, data: any, userId: string) {
  try {
    const tvShowData = {
      title: data.title,
      description: data.description,
      price: data.price,
      genre_id: data.genre_id,
      language: data.language,
      rating: data.rating,
      age_restriction: data.age_restriction || null,
      content_warnings: data.content_warnings || null,
      viewer_discretion: data.viewer_discretion || null,
      cast_info: data.cast_info || null,
      director: data.director || null,
      production_company: data.production_company || null,
      release_date: data.release_date,
      thumbnail_url: data.thumbnail_url,
      trailer_url: data.trailer_url,
      landscape_poster_url: data.landscape_poster_url,
      slider_cover_url: data.slider_cover_url,
      status: 'approved', // Instantly available
      uploaded_by: userId
    }

    const { data: tvShow, error } = await supabase
      .from('tv_shows')
      .insert(tvShowData)
      .select()
      .single()

    if (error) {
      console.error('Database error creating TV show:', error)
      throw error
    }

    console.log('TV show created successfully:', tvShow.id)

    return new Response(
      JSON.stringify({ success: true, tvShow }),
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Failed to create TV show:', error)
    throw error
  }
}

async function createSeason(supabase: any, data: any, userId: string) {
  try {
    const seasonData = {
      tv_show_id: data.tv_show_id,
      season_number: data.season_number,
      description: data.description,
      price: data.price,
      rental_expiry_duration: data.rental_expiry_duration || 336,
      cover_image_url: data.cover_image_url,
      status: 'approved' // Instantly available
    }

    const { data: season, error } = await supabase
      .from('seasons')
      .insert(seasonData)
      .select()
      .single()

    if (error) {
      console.error('Database error creating season:', error)
      throw error
    }

    console.log('Season created successfully:', season.id)

    return new Response(
      JSON.stringify({ success: true, season }),
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Failed to create season:', error)
    throw error
  }
}

async function createEpisode(supabase: any, data: any, userId: string) {
  try {
    const episodeData = {
      season_id: data.season_id,
      episode_number: data.episode_number,
      title: data.title,
      description: data.description,
      price: data.price,
      duration: data.duration,
      release_date: data.release_date,
      rental_expiry_duration: data.rental_expiry_duration || 48,
      video_url: data.video_url,
      thumbnail_url: data.thumbnail_url,
      status: 'approved', // Instantly available
      published_at: new Date().toISOString()
    }

    const { data: episode, error } = await supabase
      .from('episodes')
      .insert(episodeData)
      .select()
      .single()

    if (error) {
      console.error('Database error creating episode:', error)
      throw error
    }

    console.log('Episode created successfully:', episode.id)

    return new Response(
      JSON.stringify({ success: true, episode }),
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Failed to create episode:', error)
    throw error
  }
}
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { episode_id } = await req.json();

    if (!episode_id) {
      return new Response(
        JSON.stringify({ error: 'Episode ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get episode details
    const { data: episode, error: episodeError } = await supabase
      .from('episodes')
      .select(`
        *,
        seasons!inner(
          *,
          tv_shows!inner(
            title,
            trailer_url
          )
        )
      `)
      .eq('id', episode_id)
      .single();

    if (episodeError || !episode) {
      return new Response(
        JSON.stringify({ error: 'Episode not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let hasAccess = false;
    let videoUrl = null;

    // Derive user identity from JWT, not from request body
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (!authError && user) {
        const { data: payment } = await supabase
          .from('user_payments')
          .select('*')
          .eq('user_id', user.id)
          .eq('payment_status', 'success')
          .gt('access_expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        hasAccess = !!payment;

        if (hasAccess && episode.video_url) {
          const videoPath = episode.video_url.split('/').pop();
          const { data: signedUrlData } = await supabase.storage
            .from('tv-episodes')
            .createSignedUrl(videoPath, 3600);
          
          videoUrl = signedUrlData?.signedUrl || null;
        }
      }
    }

    // Always return trailer URL (public access)
    const trailerUrl = episode.seasons.tv_shows.trailer_url;

    return new Response(
      JSON.stringify({ 
        episode: {
          ...episode,
          video_url: hasAccess ? videoUrl : null
        },
        hasAccess,
        trailerUrl,
        tvShowTitle: episode.seasons.tv_shows.title
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-episode-access:', error);
    return new Response(
      JSON.stringify({ 
        hasAccess: false,
        videoUrl: null,
        error: 'An unexpected error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

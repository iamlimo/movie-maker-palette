import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { corsHeaders } from "../_shared/cors.ts";
import { authenticateUser } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, supabase } = await authenticateUser(req);
    
    const { content_id, content_type } = await req.json();

    if (!content_id || !content_type) {
      return new Response(
        JSON.stringify({ error: 'Content ID and type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has valid payment
    const { data: payment, error: paymentError } = await supabase
      .from('user_payments')
      .select('*')
      .eq('user_id', user.id)
      .eq('payment_status', 'success')
      .gt('access_expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const hasAccess = !paymentError && payment;

    // If user has access, get the video URL for episodes
    let videoUrl = null;
    if (hasAccess && content_type === 'episode') {
      const { data: episode } = await supabase
        .from('episodes')
        .select('video_url')
        .eq('id', content_id)
        .single();
      
      if (episode) {
        // Create signed URL for private video access
        const { data: signedUrlData } = await supabase.storage
          .from('tv-episodes')
          .createSignedUrl(episode.video_url.split('/').pop(), 3600); // 1 hour expiry
        
        videoUrl = signedUrlData?.signedUrl || null;
      }
    }

    return new Response(
      JSON.stringify({ 
        hasAccess,
        videoUrl,
        payment: hasAccess ? payment : null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-user-payment:', error);
    return new Response(
      JSON.stringify({ 
        hasAccess: false,
        videoUrl: null,
        error: 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
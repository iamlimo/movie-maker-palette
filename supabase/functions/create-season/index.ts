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
    
    // Check if user is super admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    
    if (userRole?.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tv_show_id, season_number, description, price, rental_expiry_duration } = await req.json();

    if (!tv_show_id || !season_number) {
      return new Response(
        JSON.stringify({ error: 'TV show ID and season number are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify TV show exists
    const { data: tvShow, error: tvShowError } = await supabase
      .from('tv_shows')
      .select('id')
      .eq('id', tv_show_id)
      .single();

    if (tvShowError || !tvShow) {
      return new Response(
        JSON.stringify({ error: 'TV show not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if season already exists
    const { data: existingSeason } = await supabase
      .from('seasons')
      .select('id')
      .eq('tv_show_id', tv_show_id)
      .eq('season_number', season_number)
      .single();

    if (existingSeason) {
      return new Response(
        JSON.stringify({ error: 'Season number already exists for this TV show' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create season record
    const { data: season, error: seasonError } = await supabase
      .from('seasons')
      .insert({
        tv_show_id,
        season_number,
        description: description || null,
        price: price || 0,
        rental_expiry_duration: rental_expiry_duration || 336
      })
      .select()
      .single();

    if (seasonError) {
      console.error('Season creation error:', seasonError);
      return new Response(
        JSON.stringify({ error: 'Failed to create season' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        season,
        message: 'Season created successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-season:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
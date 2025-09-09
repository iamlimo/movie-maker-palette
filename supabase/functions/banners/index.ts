import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const method = req.method;
    const url = new URL(req.url);
    const bannerId = url.pathname.split('/').pop();

    switch (method) {
      case 'GET':
        if (bannerId && bannerId !== 'banners') {
          // Get single banner
          const { data: banner, error } = await supabaseClient
            .from('banners')
            .select('*')
            .eq('id', bannerId)
            .single();

          if (error) throw error;
          return new Response(JSON.stringify(banner), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Get all banners
          const { data: banners, error } = await supabaseClient
            .from('banners')
            .select('*')
            .order('display_order');

          if (error) throw error;
          return new Response(JSON.stringify(banners), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

      case 'POST':
        const createData = await req.json();
        const { data: newBanner, error: createError } = await supabaseClient
          .from('banners')
          .insert(createData)
          .select()
          .single();

        if (createError) throw createError;
        return new Response(JSON.stringify(newBanner), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'PUT':
        if (!bannerId) throw new Error('Banner ID required');
        const updateData = await req.json();
        
        if (updateData.reorder && Array.isArray(updateData.reorder)) {
          // Bulk reorder
          const updates = updateData.reorder.map(item => 
            supabaseClient
              .from('banners')
              .update({ display_order: item.display_order })
              .eq('id', item.id)
          );

          const results = await Promise.all(updates);
          const errors = results.filter(result => result.error);
          
          if (errors.length > 0) {
            throw new Error('Failed to reorder some banners');
          }

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Single update
          const { data: updatedBanner, error: updateError } = await supabaseClient
            .from('banners')
            .update(updateData)
            .eq('id', bannerId)
            .select()
            .single();

          if (updateError) throw updateError;
          return new Response(JSON.stringify(updatedBanner), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

      case 'DELETE':
        if (!bannerId) throw new Error('Banner ID required');
        const { error: deleteError } = await supabaseClient
          .from('banners')
          .delete()
          .eq('id', bannerId);

        if (deleteError) throw deleteError;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        throw new Error(`Method ${method} not allowed`);
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
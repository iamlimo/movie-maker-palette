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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication error:', authError);
      throw new Error('User not authenticated');
    }

    // Check if user has super_admin role for POST, PUT, DELETE operations
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      const { data: userRole, error: roleError } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleError || !userRole || userRole.role !== 'super_admin') {
        console.error('Role check failed:', { userId: user.id, userRole, roleError });
        throw new Error('Insufficient permissions - super admin required');
      }
    }

    const method = req.method;
    let sectionId: string | null = null;
    let requestBody: any = null;
    
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
      requestBody = await req.json();
      if (method === 'PUT' || method === 'DELETE') {
        sectionId = requestBody.id;
      }
    }

    switch (method) {
      case 'GET':
        if (sectionId && sectionId !== 'sections') {
          // Get single section with content
          const { data: section, error: sectionError } = await supabaseClient
            .from('sections')
            .select(`
              *,
              content_sections (
                *,
                movies:content_id (
                  id,
                  title,
                  thumbnail_url,
                  price
                ),
                tv_shows:content_id (
                  id,
                  title,
                  thumbnail_url,
                  price
                )
              )
            `)
            .eq('id', sectionId)
            .single();

          if (sectionError) throw sectionError;
          return new Response(JSON.stringify(section), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Get all sections
          const { data: sections, error } = await supabaseClient
            .from('sections')
            .select('*')
            .order('display_order');

          if (error) throw error;
          return new Response(JSON.stringify(sections), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

      case 'POST':
        const { data: newSection, error: createError } = await supabaseClient
          .from('sections')
          .insert(requestBody)
          .select()
          .single();

        if (createError) throw createError;
        return new Response(JSON.stringify(newSection), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'PUT':
        if (!sectionId) throw new Error('Section ID required');
        const { id, ...updateData } = requestBody;
        const { data: updatedSection, error: updateError } = await supabaseClient
          .from('sections')
          .update(updateData)
          .eq('id', sectionId)
          .select()
          .single();

        if (updateError) throw updateError;
        return new Response(JSON.stringify(updatedSection), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'DELETE':
        if (!sectionId) throw new Error('Section ID required');
        const { error: deleteError } = await supabaseClient
          .from('sections')
          .delete()
          .eq('id', sectionId);

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
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
    const requestData = method !== 'GET' ? await req.json() : null;

    switch (method) {
      case 'GET':
        const url = new URL(req.url);
        const sectionId = url.searchParams.get('sectionId');
        
        let query = supabaseClient
          .from('content_sections')
          .select(`
            *,
            sections(title)
          `)
          .order('display_order');

        if (sectionId) {
          query = query.eq('section_id', sectionId);
        }

        const { data: contentSections, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify(contentSections), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'POST':
        const { assignments } = requestData;
        
        if (assignments && Array.isArray(assignments)) {
          // Bulk assignment
          const { data: newAssignments, error: bulkError } = await supabaseClient
            .from('content_sections')
            .insert(assignments)
            .select();

          if (bulkError) throw bulkError;
          return new Response(JSON.stringify(newAssignments), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Single assignment
          const { data: newAssignment, error: createError } = await supabaseClient
            .from('content_sections')
            .insert(requestData)
            .select()
            .single();

          if (createError) throw createError;
          return new Response(JSON.stringify(newAssignment), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

      case 'PUT':
        const { reorder } = requestData;
        
        if (reorder && Array.isArray(reorder)) {
          // Bulk reorder
          const updates = reorder.map(item => 
            supabaseClient
              .from('content_sections')
              .update({ display_order: item.display_order })
              .eq('id', item.id)
          );

          const results = await Promise.all(updates);
          const errors = results.filter(result => result.error);
          
          if (errors.length > 0) {
            throw new Error('Failed to reorder some items');
          }

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        break;

      case 'DELETE':
        const { content_id, content_type, section_id } = requestData;
        
        let deleteQuery = supabaseClient.from('content_sections').delete();
        
        if (content_id && content_type && section_id) {
          deleteQuery = deleteQuery
            .eq('content_id', content_id)
            .eq('content_type', content_type)
            .eq('section_id', section_id);
        } else if (requestData.id) {
          deleteQuery = deleteQuery.eq('id', requestData.id);
        } else {
          throw new Error('Invalid delete parameters');
        }

        const { error: deleteError } = await deleteQuery;
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
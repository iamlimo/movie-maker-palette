import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header missing' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is super admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Super admin required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { contentType, contentId, isHardDelete } = await req.json();

    if (!contentType || !contentId) {
      return new Response(
        JSON.stringify({ error: 'Missing contentType or contentId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const deletedFiles: string[] = [];
    const errors: string[] = [];

    if (isHardDelete) {
      // Get content details for file cleanup
      let contentData: any = null;
      
      if (contentType === 'movie') {
        const { data } = await supabase
          .from('movies')
          .select('video_url, thumbnail_url, trailer_url')
          .eq('id', contentId)
          .single();
        contentData = data;
      } else if (contentType === 'tv_show') {
        const { data } = await supabase
          .from('tv_shows')
          .select('thumbnail_url, trailer_url')
          .eq('id', contentId)
          .single();
        contentData = data;
      } else if (contentType === 'episode') {
        const { data } = await supabase
          .from('episodes')
          .select('video_url')
          .eq('id', contentId)
          .single();
        contentData = data;
      }

      // Delete associated files
      if (contentData) {
        const filesToDelete = [
          { url: contentData.video_url, bucket: 'videos' },
          { url: contentData.thumbnail_url, bucket: 'thumbnails' },
          { url: contentData.trailer_url, bucket: 'videos' }
        ].filter(file => file.url);

        for (const file of filesToDelete) {
          try {
            const filePath = file.url.split('/').pop();
            if (filePath) {
              const { error: deleteError } = await supabase.storage
                .from(file.bucket)
                .remove([filePath]);

              if (deleteError) {
                errors.push(`Failed to delete ${file.url}: ${deleteError.message}`);
              } else {
                deletedFiles.push(file.url);
              }
            }
          } catch (error) {
            errors.push(`Error deleting ${file.url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Delete from database
      const tableName = contentType === 'tv_show' ? 'tv_shows' : 
                       contentType === 'episode' ? 'episodes' : 'movies';
      
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', contentId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: `Failed to delete ${contentType}: ${deleteError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Soft delete - update status to rejected
      const tableName = contentType === 'tv_show' ? 'tv_shows' : 
                       contentType === 'episode' ? 'episodes' : 'movies';
      
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ status: 'rejected' })
        .eq('id', contentId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: `Failed to reject ${contentType}: ${updateError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: isHardDelete ? 'hard_delete' : 'soft_delete',
        contentType,
        contentId,
        deletedFiles,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in delete-content function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
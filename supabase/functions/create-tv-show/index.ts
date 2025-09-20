import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { corsHeaders } from "../_shared/cors.ts";
import { authenticateUser } from "../_shared/auth.ts";

// Helper function to get file extension and MIME type
function getContentTypeFromFile(file: File): string {
  if (file.type) return file.type;
  
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'mkv':
      return 'video/x-matroska';
    default:
      return 'application/octet-stream';
  }
}

// Helper function to validate file types
function validateFileType(file: File, expectedType: 'image' | 'video'): boolean {
  const contentType = getContentTypeFromFile(file);
  
  if (expectedType === 'image') {
    return contentType.startsWith('image/');
  } else if (expectedType === 'video') {
    return contentType.startsWith('video/');
  }
  
  return false;
}

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
        JSON.stringify({ 
          success: false,
          error: 'Unauthorized: Super admin access required' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (error) {
      console.error('Failed to parse form data:', error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid form data format' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract form fields
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const genres = JSON.parse(formData.get('genres') as string || '[]');
    const genreId = formData.get('genre_id') as string;
    const releaseDate = formData.get('release_date') as string;
    const language = formData.get('language') as string;
    const rating = formData.get('rating') as string;
    const price = parseFloat(formData.get('price') as string || '0');
    
    // Extract files
    const posterFile = formData.get('poster') as File;
    const bannerFile = formData.get('banner') as File;
    const trailerFile = formData.get('trailer') as File;

    // Validate required fields
    if (!title || !posterFile) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Title and poster are required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file types
    if (posterFile && !validateFileType(posterFile, 'image')) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Poster must be an image file (JPEG, PNG, WebP)' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (bannerFile && bannerFile.size > 0 && !validateFileType(bannerFile, 'image')) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Banner must be an image file (JPEG, PNG, WebP)' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trailerFile && trailerFile.size > 0 && !validateFileType(trailerFile, 'video')) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Trailer must be a video file (MP4, MOV, MKV)' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let posterUrl = '';
    let bannerUrl = '';
    let trailerUrl = '';

    // Upload poster to tv-show-posters bucket
    const posterFileName = `${crypto.randomUUID()}-${posterFile.name}`;
    const posterContentType = getContentTypeFromFile(posterFile);
    const posterArrayBuffer = await posterFile.arrayBuffer();
    const posterUint8Array = new Uint8Array(posterArrayBuffer);

    console.log(`Uploading poster: ${posterFileName}, content-type: ${posterContentType}, size: ${posterUint8Array.length}`);

    const { data: posterData, error: posterError } = await supabase.storage
      .from('tv-show-posters')
      .upload(posterFileName, posterUint8Array, {
        contentType: posterContentType,
        upsert: false
      });

    if (posterError) {
      console.error('Poster upload error:', posterError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Failed to upload poster: ${posterError.message}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    posterUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/tv-show-posters/${posterData.path}`;

    // Upload banner if provided, otherwise use poster
    if (bannerFile && bannerFile.size > 0) {
      const bannerFileName = `${crypto.randomUUID()}-${bannerFile.name}`;
      const bannerContentType = getContentTypeFromFile(bannerFile);
      const bannerArrayBuffer = await bannerFile.arrayBuffer();
      const bannerUint8Array = new Uint8Array(bannerArrayBuffer);

      console.log(`Uploading banner: ${bannerFileName}, content-type: ${bannerContentType}, size: ${bannerUint8Array.length}`);

      const { data: bannerData, error: bannerError } = await supabase.storage
        .from('tv-show-posters')
        .upload(bannerFileName, bannerUint8Array, {
          contentType: bannerContentType,
          upsert: false
        });

      if (bannerError) {
        console.error('Banner upload error:', bannerError);
        // Continue without banner, use poster as fallback
        bannerUrl = posterUrl;
      } else {
        bannerUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/tv-show-posters/${bannerData.path}`;
      }
    } else {
      bannerUrl = posterUrl;
    }

    // Upload trailer if provided
    if (trailerFile && trailerFile.size > 0) {
      const trailerFileName = `${crypto.randomUUID()}-${trailerFile.name}`;
      const trailerContentType = getContentTypeFromFile(trailerFile);
      const trailerArrayBuffer = await trailerFile.arrayBuffer();
      const trailerUint8Array = new Uint8Array(trailerArrayBuffer);

      console.log(`Uploading trailer: ${trailerFileName}, content-type: ${trailerContentType}, size: ${trailerUint8Array.length}`);

      const { data: trailerData, error: trailerError } = await supabase.storage
        .from('tv-trailers')
        .upload(trailerFileName, trailerUint8Array, {
          contentType: trailerContentType,
          upsert: false
        });

      if (trailerError) {
        console.error('Trailer upload error:', trailerError);
        // Continue without trailer, don't fail the entire operation
      } else {
        trailerUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/tv-trailers/${trailerData.path}`;
      }
    }

    // Create TV show record
    const { data: tvShow, error: tvShowError } = await supabase
      .from('tv_shows')
      .insert({
        title,
        description,
        genres,
        genre_id: genreId || null,
        release_date: releaseDate || null,
        language,
        rating,
        price,
        thumbnail_url: posterUrl,
        landscape_poster_url: bannerUrl,
        slider_cover_url: bannerUrl,
        trailer_url: trailerUrl || null,
        uploaded_by: user.id,
        status: 'approved'
      })
      .select()
      .single();

    if (tvShowError) {
      console.error('TV show creation error:', tvShowError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Failed to create TV show: ${tvShowError.message}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('TV show created successfully:', tvShow.title);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tvShow,
        message: 'TV show created successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-tv-show:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
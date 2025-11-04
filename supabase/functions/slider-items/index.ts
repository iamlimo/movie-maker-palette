import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, jsonResponse, handleOptions, errorResponse } from "../_shared/cors.ts";
import { authenticateUser } from "../_shared/auth.ts";

serve(async (req) => {
  // Handle CORS preflight
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();

    // GET - Fetch slider items (public access)
    if (req.method === "GET") {
      const { user, supabase } = await authenticateUser(req).catch(() => ({
        user: null,
        supabase: null
      }));
      
      // Create unauthenticated client for public access
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.56.0");
      const publicSupabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );

      const now = new Date().toISOString();
      
      const { data, error } = await publicSupabase
        .from("slider_items")
        .select("*")
        .eq("status", "active")
        .or(`promotion_starts_at.is.null,promotion_starts_at.lte.${now}`)
        .or(`promotion_ends_at.is.null,promotion_ends_at.gte.${now}`)
        .order("promotion_priority", { ascending: false })
        .order("sort_order", { ascending: true });

      if (error) throw error;

      return jsonResponse(data);
    }

    // Authenticate user for admin operations
    const { user, supabase } = await authenticateUser(req);

    // Check if user is super admin
    const { data: isAdmin } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'super_admin' });

    if (!isAdmin) {
      return errorResponse("Insufficient privileges", 403);
    }

    // POST - Create slider item
    if (req.method === "POST") {
      const body = await req.json();
      const { data, error } = await supabase
        .from("slider_items")
        .insert(body)
        .select()
        .single();

      if (error) throw error;

      return jsonResponse(data);
    }

    // PUT - Update slider item
    if (req.method === "PUT" && id) {
      const body = await req.json();
      const { data, error } = await supabase
        .from("slider_items")
        .update(body)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return jsonResponse(data);
    }

    // DELETE - Delete slider item
    if (req.method === "DELETE" && id) {
      const { error } = await supabase
        .from("slider_items")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return jsonResponse({ success: true });
    }

    return errorResponse("Method not allowed", 405);

  } catch (error: any) {
    console.error("Error in slider-items function:", error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
});
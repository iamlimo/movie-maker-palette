import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, jsonResponse, handleOptions, errorResponse } from "../_shared/cors.ts";
import { authenticateUser } from "../_shared/auth.ts";

serve(async (req) => {
  // Handle CORS preflight
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    // Authenticate user
    const { user, supabase } = await authenticateUser(req);
    
    const url = new URL(req.url);
    const contentId = url.searchParams.get('content_id');
    const contentType = url.searchParams.get('content_type');
    
    // If no params provided, try to get from request body
    if (!contentId || !contentType) {
      if (req.method === 'POST') {
        const body = await req.json();
        const cId = body.content_id || contentId;
        const cType = body.content_type || contentType;
        
        if (!cId || !cType) {
          return errorResponse("content_id and content_type are required", 400);
        }
        
        return await checkAccess(user, supabase, cId, cType);
      }
    }
    
    return await checkAccess(user, supabase, contentId, contentType);

  } catch (error: any) {
    console.error("Error in rental-access:", error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
});

async function checkAccess(user: any, supabase: any, contentId: string, contentType: string) {
  // Check for active rental
  const { data: rental } = await supabase
    .from("rentals")
    .select("*")
    .eq("user_id", user.id)
    .eq("content_id", contentId)
    .eq("content_type", contentType)
    .eq("status", "active")
    .gte("expiration_date", new Date().toISOString())
    .order("expiration_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Check for purchase
  const { data: purchase } = await supabase
    .from("purchases")
    .select("*")
    .eq("user_id", user.id)
    .eq("content_id", contentId)
    .eq("content_type", contentType)
    .maybeSingle();

  const hasAccess = !!(rental || purchase);
  
  return jsonResponse({
    has_access: hasAccess,
    access_type: rental ? 'rental' : purchase ? 'purchase' : null,
    rental: rental || null,
    purchase: purchase || null,
    expires_at: rental?.expiration_date || null
  });
}
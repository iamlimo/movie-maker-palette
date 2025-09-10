import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key",
};

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function getUser(req: Request, supabaseClient: any) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) throw new Error("No authorization header");
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

export function handleOptions(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

// Usage in your function:
serve(async (req) => {
  const optionsRes = handleOptions(req);
  if (optionsRes) return optionsRes;

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const user = await getUser(req, supabaseClient);

    // ...your function logic here...

    return jsonResponse({
      success: true,
      data: {
        /* ... */
      },
    });
  } catch (error: any) {
    console.error(error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
});

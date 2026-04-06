import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");

    // Validate caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check super_admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, body, data = {}, target = "all", target_user_id } = await req.json();

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: "title and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch device tokens
    let tokenQuery = supabaseAdmin
      .from("push_device_tokens")
      .select("token, platform")
      .eq("is_active", true);

    if (target === "user" && target_user_id) {
      tokenQuery = tokenQuery.eq("user_id", target_user_id);
    }

    const { data: tokens, error: tokensError } = await tokenQuery;
    if (tokensError) {
      throw new Error(`Failed to fetch tokens: ${tokensError.message}`);
    }

    let sentCount = 0;

    if (fcmServerKey && tokens && tokens.length > 0) {
      // Send via FCM legacy HTTP API
      const fcmUrl = "https://fcm.googleapis.com/fcm/send";

      // Send in batches of 1000 (FCM limit)
      const batchSize = 1000;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        const registrationIds = batch.map((t: any) => t.token);

        const fcmPayload = {
          registration_ids: registrationIds,
          notification: { title, body },
          data: { ...data, title, body },
        };

        const fcmRes = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${fcmServerKey}`,
          },
          body: JSON.stringify(fcmPayload),
        });

        if (fcmRes.ok) {
          const result = await fcmRes.json();
          sentCount += result.success || 0;

          // Clean up invalid tokens
          if (result.results) {
            for (let j = 0; j < result.results.length; j++) {
              if (result.results[j].error === "InvalidRegistration" ||
                  result.results[j].error === "NotRegistered") {
                await supabaseAdmin
                  .from("push_device_tokens")
                  .update({ is_active: false })
                  .eq("token", registrationIds[j]);
              }
            }
          }
        }
      }
    } else {
      sentCount = tokens?.length || 0;
    }

    // Record notification
    await supabaseAdmin.from("push_notifications").insert({
      title,
      body,
      data,
      target,
      target_user_id: target === "user" ? target_user_id : null,
      sent_count: sentCount,
      created_by: user.id,
    });

    return new Response(
      JSON.stringify({ success: true, sent_count: sentCount, total_tokens: tokens?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PushSubscriptionJSON = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing Supabase environment variables" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse(401, { error: "Missing bearer token" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) {
    return jsonResponse(401, { error: "Invalid user session" });
  }

  let body: { subscription?: PushSubscriptionJSON };
  try {
    body = (await req.json()) as { subscription?: PushSubscriptionJSON };
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const sub = body.subscription;
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint.trim() : "";
  const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh.trim() : "";
  const authSecret = typeof sub?.keys?.auth === "string" ? sub.keys.auth.trim() : "";
  if (!endpoint || !p256dh || !authSecret) {
    return jsonResponse(400, { error: "Invalid push subscription payload" });
  }

  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth_secret: authSecret,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return jsonResponse(500, { error: error.message });
  }

  return jsonResponse(200, { ok: true });
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RestorePayload = {
  email?: string;
};

function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

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
    return jsonResponse(500, { error: "Missing Supabase service role environment variables" });
  }

  let payload: RestorePayload;
  try {
    payload = (await req.json()) as RestorePayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const email = normalizeEmail(payload.email);
  if (!email || !email.includes("@")) {
    return jsonResponse(400, { error: "Valid email is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await adminClient.from("members").update({ is_active: true }).eq("email", email).eq("is_active", false);
  if (error) {
    return jsonResponse(500, { error: error.message });
  }

  return jsonResponse(200, { message: "Member restored" });
});

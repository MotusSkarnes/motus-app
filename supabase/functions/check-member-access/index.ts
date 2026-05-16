import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MEMBER_ARCHIVED_MESSAGE =
  "Kundekontoen er arkivert. Kontakt din PT for å gjenåpne tilgang til appen.";

function normalizeEmail(value: unknown): string {
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

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) {
    return jsonResponse(401, { error: "Missing bearer token" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: "Invalid session token" });
  }

  let bodyEmail = "";
  try {
    const payload = (await req.json()) as { email?: string };
    bodyEmail = normalizeEmail(payload.email);
  } catch {
    bodyEmail = "";
  }

  const requesterEmail = bodyEmail || normalizeEmail(userData.user.email);
  if (!requesterEmail.includes("@")) {
    return jsonResponse(400, { error: "Valid email is required" });
  }

  const { data: rows, error: fetchError } = await adminClient
    .from("members")
    .select("id, email, is_active")
    .ilike("email", requesterEmail);

  if (fetchError) {
    return jsonResponse(500, { error: fetchError.message });
  }

  const matchingRows = (rows ?? []).filter((row) => normalizeEmail((row as { email?: string }).email) === requesterEmail);
  if (matchingRows.length > 0 && !matchingRows.some((row) => (row as { is_active?: boolean }).is_active !== false)) {
    return jsonResponse(403, {
      status: "archived",
      error: "member_archived",
      message: MEMBER_ARCHIVED_MESSAGE,
    });
  }

  return jsonResponse(200, {
    status: matchingRows.some((row) => (row as { is_active?: boolean }).is_active !== false) ? "active" : "no_roster",
    rosterCount: matchingRows.length,
  });
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DeletePayload = {
  memberId?: string;
};

type AuthUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isTrainerUser(user: AuthUser): boolean {
  const appRole = String(user.app_metadata?.role ?? "").trim().toLowerCase();
  const userRole = String(user.user_metadata?.role ?? "").trim().toLowerCase();
  if (appRole === "trainer" || userRole === "trainer") return true;
  return normalizeEmail(user.email).endsWith("@motus-skarnes.no");
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

  let payload: DeletePayload;
  try {
    payload = (await req.json()) as DeletePayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const memberId = payload.memberId?.trim() ?? "";
  if (!memberId) {
    return jsonResponse(400, { error: "memberId is required" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return jsonResponse(401, { error: "Authorization bearer token is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user: caller },
    error: userError,
  } = await adminClient.auth.getUser(accessToken);
  if (userError || !caller?.id) {
    return jsonResponse(401, { error: "Invalid trainer session" });
  }
  if (!isTrainerUser(caller as AuthUser)) {
    return jsonResponse(403, { error: "Only trainers can delete members" });
  }

  const { data: memberRow, error: memberError } = await adminClient
    .from("members")
    .select("id, owner_user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (memberError) {
    return jsonResponse(500, { error: `Could not load member: ${memberError.message}` });
  }
  if (!memberRow) {
    return jsonResponse(404, { error: "Member not found" });
  }
  const ownerUserId = String((memberRow as { owner_user_id?: string | null }).owner_user_id ?? "").trim();
  if (ownerUserId !== caller.id) {
    return jsonResponse(403, { error: "You can only delete members owned by your trainer account" });
  }

  const targetMemberIds = new Set<string>([memberId]);

  // Arkiver kun — slett aldri programmer/logger/meldinger (gjenoppretting og PT-synlighet).
  for (const id of targetMemberIds) {
    await adminClient.from("members").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", id);
  }

  return jsonResponse(200, { message: "Member archived", archived: true });
});


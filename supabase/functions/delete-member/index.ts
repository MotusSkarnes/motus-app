import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DeletePayload = {
  memberId?: string;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function getUserRole(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }): string {
  const appRole = user.app_metadata?.role;
  if (appRole === "member" || appRole === "trainer") return appRole;
  const userRole = user.user_metadata?.role;
  if (userRole === "member" || userRole === "trainer") return userRole;
  return "";
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

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse(401, { error: "Missing bearer token" });
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

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  const user = authData?.user ?? null;
  if (authError || !user) {
    return jsonResponse(401, { error: "Invalid user session" });
  }
  if (getUserRole(user) !== "trainer") {
    return jsonResponse(403, { error: "Only trainers can delete members" });
  }

  const { data: memberRow, error: memberLookupError } = await adminClient
    .from("members")
    .select("id, owner_user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (memberLookupError) {
    return jsonResponse(500, { error: `Could not verify member ownership: ${memberLookupError.message}` });
  }
  if (!memberRow) {
    return jsonResponse(404, { error: "Member not found" });
  }
  if (normalizeString((memberRow as { owner_user_id?: string | null }).owner_user_id) !== user.id) {
    return jsonResponse(403, { error: "Cannot delete a member owned by another trainer" });
  }

  const targetMemberIds = new Set<string>([memberId]);

  for (const id of targetMemberIds) {
    await adminClient.from("members").update({ is_active: false }).eq("id", id);
    await adminClient.from("chat_messages").delete().eq("member_id", id).eq("owner_user_id", user.id);
    await adminClient.from("workout_logs").delete().eq("member_id", id).eq("owner_user_id", user.id);
    await adminClient.from("training_programs").delete().eq("member_id", id).eq("owner_user_id", user.id);
  }

  return jsonResponse(200, { message: "Member deletion completed" });
});


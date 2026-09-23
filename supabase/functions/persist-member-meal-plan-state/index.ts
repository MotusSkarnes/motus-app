import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse(500, { error: "Missing service configuration" });

  const token = normalize(req.headers.get("Authorization")).replace(/^Bearer\s+/i, "");
  if (!token) return jsonResponse(401, { error: "Missing bearer token" });

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return jsonResponse(401, { error: "Invalid session token" });

  let body: { memberId?: unknown; state?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }
  const memberId = normalize(body.memberId);
  if (!memberId || !body.state || typeof body.state !== "object" || Array.isArray(body.state)) {
    return jsonResponse(400, { error: "memberId and state are required" });
  }

  const { data: member, error: memberError } = await admin
    .from("members")
    .select("id, email, owner_user_id, is_active")
    .eq("id", memberId)
    .maybeSingle();
  if (memberError) return jsonResponse(500, { error: memberError.message });
  if (!member || member.is_active === false) return jsonResponse(403, { error: "Member is unavailable" });

  const userEmail = normalize(user.email).toLowerCase();
  const memberEmail = normalize(member.email).toLowerCase();
  const linkedMemberId = normalize(user.app_metadata?.member_id || user.user_metadata?.member_id);
  const ownerUserId = normalize(member.owner_user_id);
  const authorized =
    memberId === linkedMemberId ||
    (Boolean(userEmail) && userEmail === memberEmail) ||
    ownerUserId === user.id;
  if (!authorized) return jsonResponse(403, { error: "Not allowed for this member" });

  const updatedAt = new Date().toISOString();
  const state = { ...(body.state as Record<string, unknown>), updatedAt };
  const { error } = await admin.from("member_meal_plan_state").upsert(
    { member_id: memberId, state, updated_at: updatedAt },
    { onConflict: "member_id" },
  );
  if (error) return jsonResponse(500, { error: error.message });
  return jsonResponse(200, { ok: true, memberId, updatedAt });
});

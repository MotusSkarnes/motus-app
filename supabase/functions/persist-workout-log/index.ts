import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PersistWorkoutLogPayload = {
  id?: string;
  memberId?: string;
  programTitle?: string;
  date?: string;
  status?: string;
  note?: string;
  results?: unknown;
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

  let payload: PersistWorkoutLogPayload;
  try {
    payload = (await req.json()) as PersistWorkoutLogPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const id = String(payload.id ?? "").trim();
  const memberId = String(payload.memberId ?? "").trim();
  const programTitle = String(payload.programTitle ?? "").trim();
  const date = String(payload.date ?? "").trim();
  const status = payload.status === "Planlagt" ? "Planlagt" : "Fullført";
  const note = String(payload.note ?? "");
  const results = Array.isArray(payload.results) ? payload.results : [];
  if (!id || !memberId || !programTitle) {
    return jsonResponse(400, { error: "id, memberId and programTitle are required" });
  }

  const user = userData.user;
  const requesterEmail = normalizeEmail(user.email);
  const requesterId = String(user.id ?? "").trim();
  const requesterRole = (() => {
    const appRole = user.app_metadata?.role;
    if (appRole === "trainer" || appRole === "member") return appRole;
    const userRole = user.user_metadata?.role;
    if (userRole === "trainer" || userRole === "member") return userRole;
    return "";
  })();

  const { data: memberRow, error: memberError } = await adminClient
    .from("members")
    .select("id, email, owner_user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (memberError || !memberRow) {
    return jsonResponse(404, { error: "Member not found" });
  }

  const memberEmail = normalizeEmail((memberRow as { email?: string }).email);
  const memberOwner = String((memberRow as { owner_user_id?: string }).owner_user_id ?? "").trim();
  const isMemberOwner = requesterRole === "trainer" && memberOwner === requesterId;
  const isSameMemberEmail = requesterRole === "member" && requesterEmail && requesterEmail === memberEmail;
  if (!isMemberOwner && !isSameMemberEmail) {
    return jsonResponse(403, { error: "Not authorized to persist workout log for this member" });
  }

  let ownerUserId = memberOwner;
  if (!ownerUserId) {
    const { data: programOwnerRow } = await adminClient
      .from("training_programs")
      .select("owner_user_id")
      .eq("member_id", memberId)
      .not("owner_user_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    ownerUserId = String((programOwnerRow as { owner_user_id?: string } | null)?.owner_user_id ?? "").trim();
  }
  if (!ownerUserId && memberEmail) {
    const { data: ownerMemberByEmail } = await adminClient
      .from("members")
      .select("owner_user_id")
      .eq("email", memberEmail)
      .not("owner_user_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    ownerUserId = String((ownerMemberByEmail as { owner_user_id?: string } | null)?.owner_user_id ?? "").trim();
  }
  if (!ownerUserId && requesterRole === "trainer") {
    ownerUserId = requesterId;
  }
  if (!ownerUserId) {
    return jsonResponse(409, { error: "Could not resolve trainer owner for member log" });
  }

  if (!memberOwner) {
    await adminClient.from("members").update({ owner_user_id: ownerUserId }).eq("id", memberId);
  }

  const { error: upsertError } = await adminClient.from("workout_logs").upsert(
    {
      id,
      member_id: memberId,
      owner_user_id: ownerUserId,
      program_title: programTitle,
      date,
      status,
      note,
      results,
      created_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (upsertError) {
    return jsonResponse(500, { error: upsertError.message });
  }

  return jsonResponse(200, { ok: true, ownerUserId });
});

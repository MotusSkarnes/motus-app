import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DedupePayload = {
  ownerUserId?: string;
  apply?: boolean;
};

type MemberRow = {
  id?: string;
  owner_user_id?: string | null;
  email?: string | null;
  name?: string | null;
  is_active?: boolean | null;
  invited_at?: string | null;
  days_since_activity?: string | null;
  customer_type?: string | null;
  membership_type?: string | null;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toDaysSinceActivity(value: string | null | undefined): number {
  const parsed = Number(value ?? "9999");
  return Number.isFinite(parsed) ? parsed : 9999;
}

function memberScore(row: MemberRow): number {
  let score = 0;
  if (row.is_active !== false) score += 8;
  if (row.invited_at) score += 2;
  if (String(row.customer_type ?? "") === "PT-kunde") score += 1;
  if (String(row.membership_type ?? "") === "Premium") score += 1;
  const days = toDaysSinceActivity(row.days_since_activity);
  score += Math.max(0, 100 - Math.min(100, days));
  return score;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing Supabase service role environment variables" });
  }

  let payload: DedupePayload = {};
  try {
    payload = (await req.json()) as DedupePayload;
  } catch {
    payload = {};
  }

  const ownerUserId = String(payload.ownerUserId ?? "").trim();
  const apply = payload.apply === true;
  if (!ownerUserId) {
    return jsonResponse(400, { error: "ownerUserId is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: members, error: membersError } = await adminClient
    .from("members")
    .select("id, owner_user_id, email, name, is_active, invited_at, days_since_activity, customer_type, membership_type")
    .eq("owner_user_id", ownerUserId);

  if (membersError) {
    return jsonResponse(500, { error: membersError.message });
  }

  const memberRows = (members ?? []) as MemberRow[];
  const byEmail = new Map<string, MemberRow[]>();
  memberRows.forEach((row) => {
    const emailKey = String(row.email ?? "").trim().toLowerCase();
    if (!emailKey) return;
    const group = byEmail.get(emailKey) ?? [];
    group.push(row);
    byEmail.set(emailKey, group);
  });

  const duplicateGroups = Array.from(byEmail.entries()).filter(([, rows]) => rows.length > 1);
  const groupResults: Array<Record<string, unknown>> = [];

  for (const [email, rows] of duplicateGroups) {
    const sorted = [...rows].sort((a, b) => memberScore(b) - memberScore(a));
    const canonical = sorted[0];
    const canonicalId = String(canonical.id ?? "").trim();
    const duplicateIds = sorted
      .slice(1)
      .map((row) => String(row.id ?? "").trim())
      .filter(Boolean);
    if (!canonicalId || duplicateIds.length === 0) continue;

    let movedPrograms = 0;
    let movedLogs = 0;
    let movedMessages = 0;
    let deactivatedMembers = 0;

    if (apply) {
      const { data: updatedPrograms, error: programsError } = await adminClient
        .from("training_programs")
        .update({ member_id: canonicalId })
        .in("member_id", duplicateIds)
        .select("id");
      if (programsError) {
        return jsonResponse(500, { error: `Program update failed for ${email}: ${programsError.message}` });
      }
      movedPrograms = (updatedPrograms ?? []).length;

      const { data: updatedLogs, error: logsError } = await adminClient
        .from("workout_logs")
        .update({ member_id: canonicalId })
        .in("member_id", duplicateIds)
        .select("id");
      if (logsError) {
        return jsonResponse(500, { error: `Workout log update failed for ${email}: ${logsError.message}` });
      }
      movedLogs = (updatedLogs ?? []).length;

      const { data: updatedMessages, error: messagesError } = await adminClient
        .from("chat_messages")
        .update({ member_id: canonicalId })
        .in("member_id", duplicateIds)
        .select("id");
      if (messagesError) {
        return jsonResponse(500, { error: `Message update failed for ${email}: ${messagesError.message}` });
      }
      movedMessages = (updatedMessages ?? []).length;

      const { data: updatedMembers, error: membersUpdateError } = await adminClient
        .from("members")
        .update({ is_active: false })
        .in("id", duplicateIds)
        .select("id");
      if (membersUpdateError) {
        return jsonResponse(500, { error: `Member deactivate failed for ${email}: ${membersUpdateError.message}` });
      }
      deactivatedMembers = (updatedMembers ?? []).length;
    }

    groupResults.push({
      email,
      canonicalId,
      duplicateIds,
      movedPrograms,
      movedLogs,
      movedMessages,
      deactivatedMembers,
    });
  }

  return jsonResponse(200, {
    ownerUserId,
    apply,
    duplicateGroupCount: duplicateGroups.length,
    groups: groupResults,
  });
});


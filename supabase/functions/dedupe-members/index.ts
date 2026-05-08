import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DedupePayload = {
  ownerUserId?: string;
  apply?: boolean;
  sharedGlobal?: boolean;
  email?: string;
  forceProfile?: {
    name?: string;
    phone?: string;
    birthDate?: string;
  };
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

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
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
  const sharedGlobal = payload.sharedGlobal === true;
  const targetEmail = normalizeEmail(payload.email);
  const forceProfile = payload.forceProfile ?? null;
  if (!ownerUserId && !sharedGlobal) {
    return jsonResponse(400, { error: "ownerUserId is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const membersQuery = adminClient
    .from("members")
    .select("id, owner_user_id, email, name, is_active, invited_at, days_since_activity, customer_type, membership_type");
  const shouldScanAllMembersForTarget = sharedGlobal && Boolean(targetEmail);
  const { data: members, error: membersError } = shouldScanAllMembersForTarget
    ? await membersQuery
    : sharedGlobal
      ? await membersQuery.ilike("customer_type", "%medlem%")
      : await membersQuery.eq("owner_user_id", ownerUserId);

  if (membersError) {
    return jsonResponse(500, { error: membersError.message });
  }

  const memberRows = (members ?? []) as MemberRow[];
  const debugTargetRows = targetEmail
    ? memberRows
        .filter((row) => {
          const rowEmail = normalizeEmail(row.email);
          const rowName = String(row.name ?? "").trim().toLowerCase();
          return rowEmail === targetEmail || rowName.includes("test medlem") || rowName.includes("test med");
        })
        .map((row) => ({
          id: String(row.id ?? "").trim(),
          email: normalizeEmail(row.email),
          name: String(row.name ?? "").trim(),
          ownerUserId: String(row.owner_user_id ?? "").trim(),
          customerType: String(row.customer_type ?? "").trim(),
        }))
    : [];
  if (apply && targetEmail && forceProfile) {
    const name = String(forceProfile.name ?? "").trim();
    const normalizedName = name.toLowerCase();
    const phone = String(forceProfile.phone ?? "").trim();
    const birthDate = String(forceProfile.birthDate ?? "").trim();
    const targetIds = memberRows
      .filter((row) => {
        const rowEmail = normalizeEmail(row.email);
        if (rowEmail === targetEmail) return true;
        const rowName = String(row.name ?? "").trim().toLowerCase();
        if (normalizedName && rowName && rowName.startsWith(normalizedName)) return true;
        return false;
      })
      .map((row) => String(row.id ?? "").trim())
      .filter(Boolean);
    if (targetIds.length > 0) {
      const { data: updatedRows, error: forceProfileError } = await adminClient
        .from("members")
        .update({
          ...(name ? { name } : {}),
          ...(phone ? { phone } : {}),
          ...(birthDate ? { birth_date: birthDate } : {}),
          email: targetEmail,
        })
        .in("id", targetIds)
        .select("id");
      if (forceProfileError) {
        return jsonResponse(500, { error: `Force profile sync failed: ${forceProfileError.message}` });
      }
      return jsonResponse(200, {
        ownerUserId,
        apply,
        sharedGlobal,
        targetEmail,
        forceProfileApplied: true,
        debugTargetRows,
        updatedMembers: (updatedRows ?? []).map((row) => String((row as { id?: string }).id ?? "").trim()).filter(Boolean),
      });
    }
  }
  const byEmail = new Map<string, MemberRow[]>();
  memberRows.forEach((row) => {
    const emailKey = normalizeEmail(row.email);
    if (!emailKey) return;
    const group = byEmail.get(emailKey) ?? [];
    group.push(row);
    byEmail.set(emailKey, group);
  });

  const duplicateGroups = Array.from(byEmail.entries()).filter(([email, rows]) => {
    if (rows.length <= 1) return false;
    if (!targetEmail) return true;
    return email === targetEmail;
  });
  if (targetEmail && duplicateGroups.length === 0) {
    const seedRows = memberRows.filter((row) => normalizeEmail(row.email) === targetEmail);
    const seedNames = new Set(seedRows.map((row) => String(row.name ?? "").trim().toLowerCase()).filter(Boolean));
    if (seedNames.size > 0) {
      const connectedRows = memberRows.filter((row) => {
        const emailKey = normalizeEmail(row.email);
        if (emailKey === targetEmail) return true;
        const nameKey = String(row.name ?? "").trim().toLowerCase();
        return Boolean(nameKey) && seedNames.has(nameKey);
      });
      if (connectedRows.length > 1) {
        duplicateGroups.push([targetEmail, connectedRows]);
      }
    }
  }
  const groupResults: Array<Record<string, unknown>> = [];

  let authUsersByEmail = new Map<string, string[]>();
  if (sharedGlobal) {
    const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      return jsonResponse(500, { error: `Could not list auth users: ${listError.message}` });
    }
    for (const user of listData?.users ?? []) {
      const emailKey = normalizeEmail(user.email);
      if (!emailKey) continue;
      const ids = authUsersByEmail.get(emailKey) ?? [];
      const authUserId = String(user.id ?? "").trim();
      if (authUserId) ids.push(authUserId);
      authUsersByEmail.set(emailKey, ids);
    }
  }

  for (const [email, rows] of duplicateGroups) {
    const sorted = [...rows].sort((a, b) => memberScore(b) - memberScore(a));
    const canonical = sorted[0];
    const canonicalId = String(canonical.id ?? "").trim();
    const duplicateIds = sorted
      .slice(1)
      .map((row) => String(row.id ?? "").trim())
      .filter(Boolean);
    if (sharedGlobal) {
      for (const authUserId of authUsersByEmail.get(email) ?? []) {
        if (authUserId && authUserId !== canonicalId) duplicateIds.push(authUserId);
        if (authUserId && `auth-${authUserId}` !== canonicalId) duplicateIds.push(`auth-${authUserId}`);
      }
      duplicateIds.push(email);
    }
    const uniqueDuplicateIds = Array.from(new Set(duplicateIds)).filter((id) => id && id !== canonicalId);
    if (!canonicalId || uniqueDuplicateIds.length === 0) continue;

    let movedPrograms = 0;
    let movedLogs = 0;
    let movedMessages = 0;
    let deactivatedMembers = 0;

    if (apply) {
      const { data: updatedPrograms, error: programsError } = await adminClient
        .from("training_programs")
        .update({ member_id: canonicalId })
        .in("member_id", uniqueDuplicateIds)
        .select("id");
      if (programsError) {
        return jsonResponse(500, { error: `Program update failed for ${email}: ${programsError.message}` });
      }
      movedPrograms = (updatedPrograms ?? []).length;

      const { data: updatedLogs, error: logsError } = await adminClient
        .from("workout_logs")
        .update({ member_id: canonicalId })
        .in("member_id", uniqueDuplicateIds)
        .select("id");
      if (logsError) {
        return jsonResponse(500, { error: `Workout log update failed for ${email}: ${logsError.message}` });
      }
      movedLogs = (updatedLogs ?? []).length;

      const { data: updatedMessages, error: messagesError } = await adminClient
        .from("chat_messages")
        .update({ member_id: canonicalId })
        .in("member_id", uniqueDuplicateIds)
        .select("id");
      if (messagesError) {
        return jsonResponse(500, { error: `Message update failed for ${email}: ${messagesError.message}` });
      }
      movedMessages = (updatedMessages ?? []).length;

      if (!sharedGlobal) {
        const { data: updatedMembers, error: membersUpdateError } = await adminClient
          .from("members")
          .update({ is_active: false })
          .in("id", uniqueDuplicateIds)
          .select("id");
        if (membersUpdateError) {
          return jsonResponse(500, { error: `Member deactivate failed for ${email}: ${membersUpdateError.message}` });
        }
        deactivatedMembers = (updatedMembers ?? []).length;
      }
    }

    groupResults.push({
      email,
      canonicalId,
      duplicateIds: uniqueDuplicateIds,
      movedPrograms,
      movedLogs,
      movedMessages,
      deactivatedMembers,
    });
  }

  return jsonResponse(200, {
    ownerUserId,
    apply,
    sharedGlobal,
    targetEmail,
    debugTargetRows,
    duplicateGroupCount: duplicateGroups.length,
    groups: groupResults,
  });
});


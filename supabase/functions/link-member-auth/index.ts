import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LinkPayload = {
  email?: string;
  memberId?: string;
};

type MemberCandidate = {
  id: string;
  is_active: boolean | null;
  created_at: string | null;
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

function parseDateScore(value: string | null): number {
  if (!value) return 0;
  const parsed = new Date(value);
  const score = parsed.getTime();
  return Number.isFinite(score) ? score : 0;
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

  let payload: LinkPayload;
  try {
    payload = (await req.json()) as LinkPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const email = normalizeEmail(payload.email);
  let memberId = String(payload.memberId ?? "").trim();
  if (!email || !email.includes("@")) {
    return jsonResponse(400, { error: "Valid email is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: memberRows, error: memberLookupError } = await adminClient
    .from("members")
    .select("id, is_active, created_at")
    .eq("email", email);
  if (memberLookupError) {
    return jsonResponse(500, { error: `Could not resolve member by email: ${memberLookupError.message}` });
  }
  const candidates = (memberRows ?? [])
    .map((row) => ({
      id: String((row as MemberCandidate).id ?? "").trim(),
      is_active: (row as MemberCandidate).is_active ?? null,
      created_at: (row as MemberCandidate).created_at ?? null,
    }))
    .filter((row) => row.id);
  if (!candidates.length) {
    return jsonResponse(404, { error: "No member row found for email" });
  }

  const candidateIds = candidates.map((row) => row.id);
  const { data: programRows, error: programLookupError } = await adminClient
    .from("training_programs")
    .select("member_id")
    .in("member_id", candidateIds);
  if (programLookupError) {
    return jsonResponse(500, { error: `Could not resolve member programs: ${programLookupError.message}` });
  }
  const programCountByMemberId = new Map<string, number>();
  (programRows ?? []).forEach((row) => {
    const resolvedMemberId = String((row as { member_id?: string }).member_id ?? "").trim();
    if (!resolvedMemberId) return;
    programCountByMemberId.set(resolvedMemberId, (programCountByMemberId.get(resolvedMemberId) ?? 0) + 1);
  });

  // Canonical choice:
  // 1) member with most programs
  // 2) active member preferred
  // 3) newest created member
  const canonicalCandidate = [...candidates].sort((a, b) => {
    const aPrograms = programCountByMemberId.get(a.id) ?? 0;
    const bPrograms = programCountByMemberId.get(b.id) ?? 0;
    if (bPrograms !== aPrograms) return bPrograms - aPrograms;
    const aActive = a.is_active === false ? 0 : 1;
    const bActive = b.is_active === false ? 0 : 1;
    if (bActive !== aActive) return bActive - aActive;
    const aCreated = parseDateScore(a.created_at);
    const bCreated = parseDateScore(b.created_at);
    if (bCreated !== aCreated) return bCreated - aCreated;
    return a.id.localeCompare(b.id);
  })[0];

  const requestedCandidate = memberId ? candidates.find((candidate) => candidate.id === memberId) : null;
  // Respect explicitly requested member row when provided and valid.
  memberId = (requestedCandidate?.id || canonicalCandidate?.id || "").trim();
  if (!memberId) {
    return jsonResponse(404, { error: "No member row found for email" });
  }

  const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    return jsonResponse(500, { error: `Could not list auth users: ${listError.message}` });
  }

  const users = listData?.users ?? [];
  const targetUsers = users.filter((user) => normalizeEmail(user.email) === email);
  if (!targetUsers.length) {
    return jsonResponse(200, { message: "No matching auth user found for email", updated: 0 });
  }

  let updated = 0;
  for (const user of targetUsers) {
    const existingAppMetadata =
      user.app_metadata && typeof user.app_metadata === "object"
        ? (user.app_metadata as Record<string, unknown>)
        : {};
    const existingUserMetadata =
      user.user_metadata && typeof user.user_metadata === "object"
        ? (user.user_metadata as Record<string, unknown>)
        : {};

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...existingAppMetadata,
        role: "member",
        member_id: memberId,
      },
      user_metadata: {
        ...existingUserMetadata,
        role: "member",
        member_id: memberId,
      },
    });
    if (!updateError) {
      updated += 1;
    }
  }

  return jsonResponse(200, { message: "Auth member link synced", updated });
});

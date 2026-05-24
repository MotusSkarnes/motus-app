import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JwtUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type ProgramRow = {
  id?: string;
  member_id?: string;
  title?: string;
  goal?: string;
  notes?: string;
  exercises?: unknown;
  created_at?: string;
  owner_user_id?: string;
  program_created_by?: string;
};

type DeleteProgramPayload = {
  programId?: string;
  memberIds?: string[];
  targetEmail?: string;
  targetName?: string;
  requestedBy?: "member" | "trainer";
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

function normalizeId(value: unknown): string {
  return String(value ?? "").trim();
}

function roleFromUser(user: JwtUser): "member" | "trainer" {
  const app = user.app_metadata?.role;
  if (app === "member" || app === "trainer") return app;
  const meta = user.user_metadata?.role;
  if (meta === "member" || meta === "trainer") return meta;
  return "trainer";
}

function buildProgramFingerprint(input: {
  title?: unknown;
  goal?: unknown;
  notes?: unknown;
  exercises?: unknown;
}): string {
  const exercises = Array.isArray(input.exercises) ? input.exercises : [];
  const exerciseFingerprint = exercises
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return [
        row.exerciseName,
        row.sets,
        row.reps,
        row.weight,
        row.holdSeconds,
        row.durationMinutes,
        row.speed,
        row.incline,
        row.restSeconds,
        row.targetHrPercent,
        row.notes,
      ]
        .map((value) => String(value ?? "").trim())
        .join("|");
    })
    .join("||");
  return [
    String(input.title ?? "").trim(),
    String(input.goal ?? "").trim(),
    String(input.notes ?? "").trim(),
    exerciseFingerprint,
  ].join("::");
}

async function resolveRelatedMemberIds(
  adminClient: ReturnType<typeof createClient>,
  input: {
    memberId?: string;
    requesterEmail?: string;
    authMemberId?: string;
    requesterUserId?: string;
    contextMemberIds?: string[];
    targetEmail?: string;
  },
): Promise<string[]> {
  const ids = new Set<string>();
  for (const raw of input.contextMemberIds ?? []) {
    const id = normalizeId(raw);
    if (id && id !== "__template__") ids.add(id);
  }

  const memberId = normalizeId(input.memberId);
  if (memberId && memberId !== "__template__") ids.add(memberId);

  const authMemberId = normalizeId(input.authMemberId);
  if (authMemberId && authMemberId !== "__template__") ids.add(authMemberId);

  const requesterUserId = normalizeId(input.requesterUserId);
  if (requesterUserId) {
    ids.add(requesterUserId);
    ids.add(`auth-${requesterUserId}`);
  }

  let email = normalizeEmail(input.targetEmail) || normalizeEmail(input.requesterEmail);
  if (!email && memberId.includes("@")) email = normalizeEmail(memberId);

  if (email) {
    ids.add(email);
    const { data: rows, error } = await adminClient.from("members").select("id").ilike("email", email);
    if (error) throw new Error(error.message);
    for (const row of rows ?? []) {
      const id = normalizeId((row as { id?: string }).id);
      if (id && id !== "__template__") ids.add(id);
    }
  }

  return Array.from(ids);
}

async function deleteLogsForProgram(
  adminClient: ReturnType<typeof createClient>,
  memberId: string,
  title: string,
) {
  const normalizedMemberId = normalizeId(memberId);
  const normalizedTitle = String(title ?? "").trim();
  if (!normalizedMemberId || !normalizedTitle) return;
  const { error } = await adminClient
    .from("workout_logs")
    .delete()
    .eq("member_id", normalizedMemberId)
    .eq("program_title", normalizedTitle);
  if (error) console.warn("delete-training-program: workout log cleanup failed:", error.message);
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

  let payload: DeleteProgramPayload;
  try {
    payload = (await req.json()) as DeleteProgramPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const programId = normalizeId(payload.programId);
  if (!programId) return jsonResponse(400, { error: "programId is required" });

  const requester = userData.user as JwtUser;
  const requesterUserId = normalizeId(requester.id);
  const requesterEmail = normalizeEmail(requester.email);
  const role = payload.requestedBy ?? roleFromUser(requester);
  const authMemberId = normalizeId(
    requester.app_metadata?.member_id ?? requester.user_metadata?.member_id,
  );

  const { data: programRowRaw, error: lookupError } = await adminClient
    .from("training_programs")
    .select("id, member_id, title, goal, notes, exercises, created_at, owner_user_id, program_created_by")
    .eq("id", programId)
    .maybeSingle();
  if (lookupError) return jsonResponse(500, { error: lookupError.message });
  if (!programRowRaw) return jsonResponse(200, { ok: true, deletedIds: [] });

  const programRow = programRowRaw as ProgramRow;
  const memberId = normalizeId(programRow.member_id);
  const relatedMemberIds = await resolveRelatedMemberIds(adminClient, {
    memberId,
    requesterEmail,
    authMemberId,
    requesterUserId,
    contextMemberIds: payload.memberIds,
    targetEmail: payload.targetEmail,
  });
  const relatedMemberIdSet = new Set(relatedMemberIds);
  const ownerUserId = normalizeId(programRow.owner_user_id);

  if (role === "member") {
    if (String(programRow.program_created_by ?? "").trim() !== "member") {
      return jsonResponse(403, { error: "Members can only delete member-created programs" });
    }
    if (!relatedMemberIdSet.has(memberId)) {
      return jsonResponse(403, { error: "Members can only delete programs on their own profile" });
    }
  } else if (ownerUserId && ownerUserId !== requesterUserId) {
    const { data: memberOwner } = await adminClient
      .from("members")
      .select("owner_user_id")
      .eq("id", memberId)
      .maybeSingle();
    const rowOwner = normalizeId((memberOwner as { owner_user_id?: string } | null)?.owner_user_id);
    if (rowOwner !== requesterUserId) {
      return jsonResponse(403, { error: "Trainer cannot delete this program" });
    }
  }

  const title = String(programRow.title ?? "");
  const targetFingerprint = buildProgramFingerprint(programRow);
  let candidateQuery = adminClient
    .from("training_programs")
    .select("id, member_id, title, goal, notes, exercises, created_at, owner_user_id, program_created_by")
    .eq("title", title);
  if (ownerUserId) candidateQuery = candidateQuery.eq("owner_user_id", ownerUserId);
  else if (relatedMemberIds.length) candidateQuery = candidateQuery.in("member_id", relatedMemberIds);

  const { data: candidateRows, error: candidateError } = await candidateQuery;
  if (candidateError) return jsonResponse(500, { error: candidateError.message });

  const idsToDelete = Array.from(
    new Set(
      (candidateRows ?? [])
        .filter((row) => {
          const candidate = row as ProgramRow;
          if (buildProgramFingerprint(candidate) !== targetFingerprint) return false;
          const candidateMemberId = normalizeId(candidate.member_id);
          if (role === "member") {
            return (
              String(candidate.program_created_by ?? "").trim() === "member" &&
              relatedMemberIdSet.has(candidateMemberId)
            );
          }
          if (ownerUserId) return normalizeId(candidate.owner_user_id) === ownerUserId;
          return !relatedMemberIds.length || relatedMemberIdSet.has(candidateMemberId);
        })
        .map((row) => normalizeId((row as ProgramRow).id))
        .filter(Boolean),
    ),
  );
  if (!idsToDelete.length) idsToDelete.push(programId);

  const { error: deleteError } = await adminClient.from("training_programs").delete().in("id", idsToDelete);
  if (deleteError) return jsonResponse(500, { error: deleteError.message });

  await Promise.all(relatedMemberIds.map((id) => deleteLogsForProgram(adminClient, id, title)));

  return jsonResponse(200, {
    ok: true,
    deletedIds: idsToDelete,
    relatedMemberIds,
  });
});

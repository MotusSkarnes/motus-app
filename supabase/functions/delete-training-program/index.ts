import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  canTrainerDeleteProgram,
  isAuthorizedMemberProgramTarget,
  readTrustedAuthMemberId,
  resolveAuthorizedDeletionMemberIds,
  resolveDeleteTrainingProgramRole,
  type DeleteProgramAuthUser,
} from "../_shared/deleteTrainingProgramSecurity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

async function resolveServerAuthorizedMemberIds(
  adminClient: ReturnType<typeof createClient>,
  input: {
    role: "member" | "trainer";
    requesterUserId: string;
    requesterEmail: string;
    trustedMemberId: string;
    programMemberId: string;
    programOwnerUserId: string;
  },
): Promise<string[]> {
  const ids = new Set<string>();
  const programMemberId = normalizeId(input.programMemberId);

  if (input.role === "member") {
    const email = normalizeEmail(input.requesterEmail);
    if (!email.includes("@")) return [];
    const { data: rows, error } = await adminClient
      .from("members")
      .select("id, email")
      .ilike("email", email);
    if (error) throw new Error(error.message);
    for (const row of rows ?? []) {
      const id = normalizeId((row as { id?: string }).id);
      const rowEmail = normalizeEmail((row as { email?: string }).email);
      if (!id || id === "__template__" || rowEmail !== email) continue;
      ids.add(id);
    }
    // Trusted app_metadata.member_id may only expand scope when it resolves to the same email.
    const trustedMemberId = normalizeId(input.trustedMemberId);
    if (trustedMemberId && trustedMemberId !== "__template__" && !ids.has(trustedMemberId)) {
      const { data: trustedRow, error: trustedError } = await adminClient
        .from("members")
        .select("id, email")
        .eq("id", trustedMemberId)
        .maybeSingle();
      if (trustedError) throw new Error(trustedError.message);
      if (trustedRow && normalizeEmail((trustedRow as { email?: string }).email) === email) {
        ids.add(trustedMemberId);
      }
    }
    return Array.from(ids);
  }

  // Trainer: only fan out across members they own (or shared Medlem), starting from the program row email.
  if (!programMemberId || programMemberId === "__template__") return [];
  const { data: programMember, error: programMemberError } = await adminClient
    .from("members")
    .select("id, email, owner_user_id, customer_type")
    .eq("id", programMemberId)
    .maybeSingle();
  if (programMemberError) throw new Error(programMemberError.message);
  if (!programMember) return [];

  if (
    canTrainerDeleteProgram({
      requesterUserId: input.requesterUserId,
      programOwnerUserId: input.programOwnerUserId,
      memberRow: programMember as { id?: string; owner_user_id?: string; customer_type?: string },
    })
  ) {
    ids.add(programMemberId);
  }

  const programEmail = normalizeEmail((programMember as { email?: string }).email);
  if (!programEmail.includes("@")) return Array.from(ids);

  const { data: emailRows, error: emailError } = await adminClient
    .from("members")
    .select("id, owner_user_id, customer_type")
    .ilike("email", programEmail);
  if (emailError) throw new Error(emailError.message);

  for (const row of emailRows ?? []) {
    const id = normalizeId((row as { id?: string }).id);
    if (!id || id === "__template__") continue;
    if (
      canTrainerDeleteProgram({
        requesterUserId: input.requesterUserId,
        programOwnerUserId: "",
        memberRow: row as { id?: string; owner_user_id?: string; customer_type?: string },
      })
    ) {
      ids.add(id);
    }
  }
  return Array.from(ids);
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

  const requester = userData.user as DeleteProgramAuthUser;
  const requesterUserId = normalizeId(requester.id);
  const requesterEmail = normalizeEmail(requester.email);
  // Ignore client-supplied requestedBy — role comes from JWT only.
  const role = resolveDeleteTrainingProgramRole(requester);
  const trustedMemberId = readTrustedAuthMemberId(requester);

  const { data: programRowRaw, error: lookupError } = await adminClient
    .from("training_programs")
    .select("id, member_id, title, goal, notes, exercises, created_at, owner_user_id, program_created_by")
    .eq("id", programId)
    .maybeSingle();
  if (lookupError) return jsonResponse(500, { error: lookupError.message });
  if (!programRowRaw) return jsonResponse(200, { ok: true, deletedIds: [] });

  const programRow = programRowRaw as ProgramRow;
  const memberId = normalizeId(programRow.member_id);
  const ownerUserId = normalizeId(programRow.owner_user_id);

  const { data: memberOwner, error: memberOwnerError } = memberId
    ? await adminClient
        .from("members")
        .select("id, email, owner_user_id, customer_type")
        .eq("id", memberId)
        .maybeSingle()
    : { data: null, error: null };
  if (memberOwnerError) return jsonResponse(500, { error: memberOwnerError.message });

  let authorizedMemberIds: string[];
  try {
    authorizedMemberIds = await resolveServerAuthorizedMemberIds(adminClient, {
      role,
      requesterUserId,
      requesterEmail,
      trustedMemberId,
      programMemberId: memberId,
      programOwnerUserId: ownerUserId,
    });
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Failed to resolve member scope" });
  }

  if (role === "member") {
    if (String(programRow.program_created_by ?? "").trim() !== "member") {
      return jsonResponse(403, { error: "Members can only delete member-created programs" });
    }
    if (
      !isAuthorizedMemberProgramTarget({
        programMemberId: memberId,
        authorizedMemberIds,
      })
    ) {
      return jsonResponse(403, { error: "Members can only delete programs on their own profile" });
    }
  } else if (
    !canTrainerDeleteProgram({
      requesterUserId,
      programOwnerUserId: ownerUserId,
      memberRow: (memberOwner as { id?: string; owner_user_id?: string; customer_type?: string } | null) ?? null,
    })
  ) {
    return jsonResponse(403, { error: "Trainer cannot delete this program" });
  }

  const relatedMemberIds = resolveAuthorizedDeletionMemberIds({
    programMemberId: memberId,
    authorizedMemberIds,
    // Client memberIds may narrow fanout, but never expand beyond server-authorized scope.
    clientMemberIds: payload.memberIds,
  });
  const relatedMemberIdSet = new Set(relatedMemberIds);

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

  // Do not cascade-delete workout logs by title: duplicate titles would erase unrelated history.
  return jsonResponse(200, {
    ok: true,
    deletedIds: idsToDelete,
    relatedMemberIds,
  });
});

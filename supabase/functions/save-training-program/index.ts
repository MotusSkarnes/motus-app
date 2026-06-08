import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ProgramExercise = Record<string, unknown>;

type SaveProgramPayload = {
  id?: string;
  memberId?: string;
  title?: string;
  goal?: string;
  notes?: string;
  exercises?: ProgramExercise[];
  targetEmail?: string;
  targetName?: string;
  customerType?: string;
  membershipType?: string;
  /** Hint only; overskrives server-side ut fra JWT-rolle. */
  programCreatedBy?: string;
  programCreatedByName?: string;
  imageUrl?: string;
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

function toFirstName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const firstToken = trimmed.split(/\s+/)[0] ?? "";
  return firstToken.trim();
}

function nameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const normalized = localPart.replace(/[._-]+/g, " ").trim();
  return toFirstName(normalized);
}

const NO_PLAN_DAY_TEMPLATE_TITLE = "Ingen plan i dag";
const TEMPLATE_KIND_PREFIX = /^__motusTemplateKind=(group|activity|no-plan)(?:\r?\n|$)/;

function templateKindFromNotes(notes: string, title: string): string | null {
  const match = String(notes ?? "").match(TEMPLATE_KIND_PREFIX);
  if (match) return match[1];
  if (title.trim() === NO_PLAN_DAY_TEMPLATE_TITLE) return "no-plan";
  return null;
}

async function findExistingSharedOrgTemplateId(
  adminClient: ReturnType<typeof createClient>,
  title: string,
  notes: string,
): Promise<string | null> {
  const saveKind = templateKindFromNotes(notes, title);
  if (saveKind !== "group" && saveKind !== "activity" && saveKind !== "no-plan") return null;
  const { data: rows } = await adminClient
    .from("training_programs")
    .select("id, notes, created_at")
    .eq("member_id", "__template__")
    .eq("title", title.trim())
    .order("created_at", { ascending: false })
    .limit(20);
  const match = (rows ?? []).find((row) => templateKindFromNotes(String(row.notes ?? ""), title) === saveKind);
  const id = String((match as { id?: string } | undefined)?.id ?? "").trim();
  return id || null;
}

type JwtUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

function roleFromUser(user: JwtUser): "member" | "trainer" {
  const app = user.app_metadata?.role;
  if (app === "member" || app === "trainer") return app;
  const um = user.user_metadata?.role;
  if (um === "member" || um === "trainer") return um;
  return "trainer";
}

function trainerDisplayFirstName(user: JwtUser): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const full = String(meta?.full_name ?? meta?.name ?? "").trim();
  if (full) return toFirstName(full);
  const em = String(user.email ?? "").trim();
  return nameFromEmail(em);
}

type ProgramAuthorColumns = {
  program_created_by: string;
  program_created_by_name: string;
};

type DbErr = { message?: string; code?: string };

function isMissingProgramAuthorColumnError(err: DbErr | null): boolean {
  if (!err?.message) return false;
  if (String(err.code ?? "") === "42703") return true;
  const m = err.message.toLowerCase();
  return (
    (m.includes("program_created_by") || m.includes("program_created_by_name")) &&
    (m.includes("does not exist") || m.includes("unknown") || m.includes("schema cache"))
  );
}

function isMissingProgramImageColumnError(err: DbErr | null): boolean {
  if (!err?.message) return false;
  if (String(err.code ?? "") === "42703") return true;
  const m = err.message.toLowerCase();
  return m.includes("image_url") && (m.includes("does not exist") || m.includes("unknown") || m.includes("schema cache"));
}

function isMissingProgramOptionalColumnError(err: DbErr | null): boolean {
  return isMissingProgramAuthorColumnError(err) || isMissingProgramImageColumnError(err);
}

function omitProgramAuthorColumns<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const { program_created_by: _a, program_created_by_name: _b, ...rest } = row;
  return rest;
}

function omitProgramImageColumn<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const { image_url: _image, ...rest } = row;
  return rest;
}

function omitProgramOptionalColumns<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  return omitProgramImageColumn(omitProgramAuthorColumns(row));
}

function programImageDbField(imageUrl: unknown): { image_url: string | null } | Record<string, never> {
  const trimmed = String(imageUrl ?? "").trim();
  return trimmed ? { image_url: trimmed } : { image_url: null };
}

async function upsertTrainingProgramWithAuthorFallback(
  adminClient: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
): Promise<{ error: DbErr | null }> {
  let { error } = await adminClient.from("training_programs").upsert(row, { onConflict: "id" });
  if (error && isMissingProgramOptionalColumnError(error)) {
    ({ error } = await adminClient.from("training_programs").upsert(omitProgramOptionalColumns(row), { onConflict: "id" }));
  }
  return { error };
}

async function insertTrainingProgramWithAuthorFallback(
  adminClient: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
): Promise<{ error: DbErr | null }> {
  let { error } = await adminClient.from("training_programs").insert(row);
  if (error && isMissingProgramOptionalColumnError(error)) {
    ({ error } = await adminClient.from("training_programs").insert(omitProgramOptionalColumns(row)));
  }
  return { error };
}

function resolveProgramAuthorColumns(
  user: JwtUser,
  role: "member" | "trainer",
  payload: SaveProgramPayload,
  hintTargetName: string,
): ProgramAuthorColumns {
  const clamp = (s: string) => s.trim().slice(0, 160);
  const hintedBy = String(payload.programCreatedBy ?? "").trim();
  if (hintedBy === "trainer") {
    const name =
      trainerDisplayFirstName(user) ||
      clamp(String(payload.programCreatedByName ?? "")) ||
      "Trener";
    return { program_created_by: "trainer", program_created_by_name: name };
  }
  if (hintedBy === "member") {
    const name =
      clamp(String(payload.programCreatedByName ?? "")) ||
      clamp(hintTargetName) ||
      nameFromEmail(String(user.email ?? ""));
    return { program_created_by: "member", program_created_by_name: name || "Medlem" };
  }
  if (role === "member") {
    const name =
      clamp(String(payload.programCreatedByName ?? "")) ||
      clamp(hintTargetName) ||
      nameFromEmail(String(user.email ?? ""));
    return { program_created_by: "member", program_created_by_name: name || "Medlem" };
  }
  const name =
    trainerDisplayFirstName(user) ||
    clamp(String(payload.programCreatedByName ?? "")) ||
    "Trener";
  return { program_created_by: "trainer", program_created_by_name: name };
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
      return `${String(row.exerciseName ?? "").trim()}|${String(row.sets ?? "").trim()}|${String(row.reps ?? "").trim()}|${String(row.weight ?? "").trim()}|${String(row.holdSeconds ?? "").trim()}|${String(row.durationMinutes ?? "").trim()}|${String(row.speed ?? "").trim()}|${String(row.incline ?? "").trim()}|${String(row.restSeconds ?? "").trim()}|${String(row.notes ?? "").trim()}`;
    })
    .join("||");
  return `${String(input.title ?? "").trim()}::${String(input.goal ?? "").trim()}::${String(input.notes ?? "").trim()}::${exerciseFingerprint}`;
}

async function resolveRelatedMemberIds(
  adminClient: ReturnType<typeof createClient>,
  memberId: string,
  hints?: {
    targetEmail?: string;
    targetName?: string;
    customerType?: string;
    membershipType?: string;
    ownerUserId?: string;
  },
): Promise<{ ids: string[]; email: string }> {
  const { data: memberRow, error: memberError } = await adminClient
    .from("members")
    .select("id, email")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) {
    throw new Error(`Could not resolve member: ${memberError.message}`);
  }

  const email = normalizeEmail((memberRow as { email?: string } | null)?.email) || normalizeEmail(hints?.targetEmail);
  if (!email) {
    throw new Error("Cannot save program without a member email. Save the member row before assigning a program.");
  }

  const { data: rows, error: rowsError } = await adminClient
    .from("members")
    .select("id")
    .ilike("email", email);

  if (rowsError) {
    throw new Error(`Could not resolve related members: ${rowsError.message}`);
  }

  const ids = Array.from(
    new Set(
      (rows ?? [])
        .map((row) => String((row as { id?: string }).id ?? "").trim())
        .filter((id) => id && id !== "__template__" && !id.startsWith("auth-")),
    ),
  );

  if (ids.length) return { ids, email };

  const targetName = String(hints?.targetName ?? "").trim() || email.split("@")[0] || "Medlem";
  const ownerUserId = String(hints?.ownerUserId ?? "").trim();
  const customerType = String(hints?.customerType ?? "").trim() || "Medlem";
  const membershipType = String(hints?.membershipType ?? "").trim() || "Standard";
  const id = memberId && memberId !== "__template__" && !memberId.startsWith("auth-") ? memberId : crypto.randomUUID();
  const { error: insertError } = await adminClient.from("members").upsert(
    {
      id,
      owner_user_id: ownerUserId || null,
      name: targetName,
      email,
      is_active: true,
      membership_type: membershipType,
      customer_type: customerType,
      days_since_activity: "0",
      goal: "",
      focus: "",
      injuries: "",
      coach_notes: "",
      personal_goals: "",
    },
    { onConflict: "id" },
  );
  if (insertError) {
    throw new Error(`Could not create missing member row: ${insertError.message}`);
  }

  return { ids: [id], email };
}

/** PT som skal eie raden i training_programs — ikke medlemmets auth-id. */
async function resolveProgramOwnerUserId(
  adminClient: ReturnType<typeof createClient>,
  role: "member" | "trainer",
  requesterUserId: string,
  memberIds: string[],
): Promise<string> {
  if (role === "trainer") return requesterUserId;
  const uniqueMemberIds = Array.from(new Set(memberIds.map((id) => id.trim()).filter(Boolean)));
  for (const memberId of uniqueMemberIds) {
    const { data } = await adminClient.from("members").select("owner_user_id").eq("id", memberId).maybeSingle();
    const ptOwner = String((data as { owner_user_id?: string } | null)?.owner_user_id ?? "").trim();
    if (ptOwner) return ptOwner;
  }
  for (const memberId of uniqueMemberIds) {
    const { data: rows } = await adminClient
      .from("training_programs")
      .select("owner_user_id")
      .eq("member_id", memberId)
      .not("owner_user_id", "is", null)
      .neq("owner_user_id", requesterUserId)
      .order("created_at", { ascending: false })
      .limit(5);
    for (const row of rows ?? []) {
      const candidate = String((row as { owner_user_id?: string }).owner_user_id ?? "").trim();
      if (candidate) return candidate;
    }
  }
  console.warn("save-training-program: could not resolve PT owner_user_id for member save");
  return requesterUserId;
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

  let payload: SaveProgramPayload;
  try {
    payload = (await req.json()) as SaveProgramPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  let memberId = String(payload.memberId ?? "").trim();
  const title = String(payload.title ?? "").trim();
  const goal = String(payload.goal ?? "").trim();
  const notes = String(payload.notes ?? "").trim();
  const exercises = Array.isArray(payload.exercises) ? payload.exercises : [];
  const requesterUserId = String(userData.user.id ?? "").trim();
  const programId = String(payload.id ?? "").trim();
  const targetEmail = normalizeEmail(payload.targetEmail);
  const targetName = String(payload.targetName ?? "").trim();
  const customerType = String(payload.customerType ?? "").trim();
  const membershipType = String(payload.membershipType ?? "").trim();
  const role = roleFromUser(userData.user);
  const imageFields = programImageDbField(payload.imageUrl);

  if (!requesterUserId) return jsonResponse(401, { error: "Missing authenticated user id" });
  if (!title) return jsonResponse(400, { error: "Title is required" });

  // Clients sometimes keep a synthetic `auth-*` id; map to DB `members.id` so upsert and RLS stay consistent.
  if ((!memberId || memberId.startsWith("auth-")) && role === "member") {
    const email = normalizeEmail(userData.user.email);
    if (!email) return jsonResponse(400, { error: "Valid memberId is required" });
    const { data: row } = await adminClient
      .from("members")
      .select("id")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row?.id) return jsonResponse(400, { error: "Valid memberId is required" });
    memberId = String(row.id).trim();
  }
  if (!memberId || memberId.startsWith("auth-")) {
    return jsonResponse(400, { error: "Valid memberId is required" });
  }

  const authorColumns = resolveProgramAuthorColumns(userData.user as JwtUser, role, payload, targetName);

  if (memberId === "__template__") {
    if (role === "member") {
      return jsonResponse(403, { error: "Medlemmer kan ikke lagre treningsmaler." });
    }
    const existingSharedId = programId ? "" : await findExistingSharedOrgTemplateId(adminClient, title, notes);
    const id = programId || existingSharedId || crypto.randomUUID();
    const { error } = await upsertTrainingProgramWithAuthorFallback(adminClient, {
      id,
      member_id: memberId,
      owner_user_id: requesterUserId,
      title,
      goal,
      notes,
      exercises,
      ...imageFields,
      created_at: new Date().toISOString(),
      program_created_by: "trainer",
      program_created_by_name: authorColumns.program_created_by_name,
    });
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(200, { ok: true, ids: [id], targetMemberIds: [memberId] });
  }

  const { ids: targetMemberIds } = await resolveRelatedMemberIds(adminClient, memberId, {
    targetEmail,
    targetName,
    customerType,
    membershipType,
    ownerUserId: requesterUserId,
  });

  const programOwnerUserId = await resolveProgramOwnerUserId(
    adminClient,
    role,
    requesterUserId,
    targetMemberIds.length ? targetMemberIds : [memberId],
  );

  if (role === "member") {
    const email = normalizeEmail(userData.user.email);
    if (!email) {
      return jsonResponse(403, { error: "Du kan bare lagre programmer på din egen profil." });
    }
    const { data: myMemberRows } = await adminClient.from("members").select("id").ilike("email", email);
    const myIds = new Set(
      (myMemberRows ?? [])
        .map((r) => String((r as { id?: string }).id ?? "").trim())
        .filter((id) => Boolean(id)),
    );
    const allowed = targetMemberIds.some((tid) => myIds.has(tid));
    if (!allowed) {
      return jsonResponse(403, { error: "Du kan bare lagre programmer på din egen profil." });
    }
  }

  const writtenIds: string[] = [];
  const canonicalTargetMemberId =
    targetMemberIds.find((targetMemberId) => targetMemberId === memberId) ?? targetMemberIds[0] ?? memberId;
  const timestamp = new Date().toISOString();

  if (programId) {
    const { error: primaryError } = await upsertTrainingProgramWithAuthorFallback(adminClient, {
      id: programId,
      member_id: canonicalTargetMemberId,
      owner_user_id: programOwnerUserId,
      title,
      goal,
      notes,
      exercises,
      ...imageFields,
      created_at: timestamp,
      program_created_by: authorColumns.program_created_by,
      program_created_by_name: authorColumns.program_created_by_name,
    });
    if (primaryError) return jsonResponse(500, { error: primaryError.message });
    writtenIds.push(programId);

    if (role !== "trainer") {
      const siblingMemberIds = targetMemberIds.filter(
        (targetMemberId) => targetMemberId && targetMemberId !== canonicalTargetMemberId,
      );
      try {
        const siblingIds = await Promise.all(
          siblingMemberIds.map(async (targetMemberId) => {
            const { data: existingRows, error: lookupError } = await adminClient
              .from("training_programs")
              .select("id")
              .eq("owner_user_id", programOwnerUserId)
              .eq("member_id", targetMemberId)
              .eq("title", title)
              .order("created_at", { ascending: false })
              .limit(1);
            if (lookupError) throw new Error(lookupError.message);

            const existingId = String((existingRows?.[0] as { id?: string } | undefined)?.id ?? "").trim();
            const rowId = existingId || crypto.randomUUID();
            const { error: writeError } = existingId
              ? await upsertTrainingProgramWithAuthorFallback(adminClient, {
                  id: rowId,
                  member_id: targetMemberId,
                  owner_user_id: programOwnerUserId,
                  title,
                  goal,
                  notes,
                  exercises,
                  ...imageFields,
                  created_at: timestamp,
                  program_created_by: authorColumns.program_created_by,
                  program_created_by_name: authorColumns.program_created_by_name,
                })
              : await insertTrainingProgramWithAuthorFallback(adminClient, {
                  id: rowId,
                  member_id: targetMemberId,
                  owner_user_id: programOwnerUserId,
                  title,
                  goal,
                  notes,
                  exercises,
                  ...imageFields,
                  created_at: timestamp,
                  program_created_by: authorColumns.program_created_by,
                  program_created_by_name: authorColumns.program_created_by_name,
                });
            if (writeError) throw new Error(writeError.message);
            return rowId;
          }),
        );
        writtenIds.push(...siblingIds);
      } catch (siblingError) {
        const message = siblingError instanceof Error ? siblingError.message : "Could not sync program to related profiles";
        return jsonResponse(500, { error: message });
      }
    }
  } else if (role === "trainer") {
    const nextId = crypto.randomUUID();
    const { error } = await insertTrainingProgramWithAuthorFallback(adminClient, {
      id: nextId,
      member_id: canonicalTargetMemberId,
      owner_user_id: programOwnerUserId,
      title,
      goal,
      notes,
      exercises,
      ...imageFields,
      created_at: timestamp,
      program_created_by: authorColumns.program_created_by,
      program_created_by_name: authorColumns.program_created_by_name,
    });
    if (error) return jsonResponse(500, { error: error.message });
    writtenIds.push(nextId);
  } else {
    const inputFingerprint = buildProgramFingerprint({ title, goal, notes, exercises });
    for (const targetMemberId of targetMemberIds) {
      if (!targetMemberId) continue;
      const { data: existingRows, error: lookupError } = await adminClient
        .from("training_programs")
        .select("id, title, goal, notes, exercises")
        .eq("owner_user_id", programOwnerUserId)
        .eq("member_id", targetMemberId)
        .eq("title", title)
        .order("created_at", { ascending: false })
        .limit(8);
      if (lookupError) return jsonResponse(500, { error: lookupError.message });

      const matchingExisting = (existingRows ?? []).find((row) => buildProgramFingerprint(row as Record<string, unknown>) === inputFingerprint);
      const existingId = String((matchingExisting as { id?: string } | undefined)?.id ?? "").trim();

      if (existingId) {
        const { error: updateError } = await upsertTrainingProgramWithAuthorFallback(adminClient, {
          id: existingId,
          member_id: targetMemberId,
          owner_user_id: programOwnerUserId,
          title,
          goal,
          notes,
          exercises,
          ...imageFields,
          created_at: timestamp,
          program_created_by: authorColumns.program_created_by,
          program_created_by_name: authorColumns.program_created_by_name,
        });
        if (updateError) return jsonResponse(500, { error: updateError.message });
        writtenIds.push(existingId);
        continue;
      }

      const nextId = crypto.randomUUID();
      const { error } = await insertTrainingProgramWithAuthorFallback(adminClient, {
        id: nextId,
        member_id: targetMemberId,
        owner_user_id: programOwnerUserId,
        title,
        goal,
        notes,
        exercises,
        ...imageFields,
        created_at: timestamp,
        program_created_by: authorColumns.program_created_by,
        program_created_by_name: authorColumns.program_created_by_name,
      });
      if (error) return jsonResponse(500, { error: error.message });
      writtenIds.push(nextId);
    }
  }

  return jsonResponse(200, {
    ok: true,
    ids: writtenIds,
    targetMemberIds: [canonicalTargetMemberId],
  });
});

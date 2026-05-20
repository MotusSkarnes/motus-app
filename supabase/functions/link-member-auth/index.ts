import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LinkPayload = {
  email?: string;
  memberId?: string;
  sourceMemberId?: string;
  sourceOwnerUserId?: string;
  /** PT som inviterer — brukes ved bootstrap, aldri medlemmets egen auth-id som owner. */
  trainerOwnerUserId?: string;
};

type MemberCandidate = {
  id: string;
  is_active: boolean | null;
  created_at: string | null;
  email?: string | null;
  owner_user_id?: string | null;
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

function firstNameFromEmail(email: string): string {
  const localPart = (email.split("@")[0] ?? "").replace(/[._-]+/g, " ").trim();
  const firstToken = localPart.split(/\s+/)[0] ?? "";
  return firstToken.trim() || "Medlem";
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
  const sourceMemberId = String(payload.sourceMemberId ?? "").trim();
  const sourceOwnerUserId = String(payload.sourceOwnerUserId ?? "").trim();
  const trainerOwnerUserId = String(payload.trainerOwnerUserId ?? sourceOwnerUserId ?? "").trim();
  if (!email || !email.includes("@")) {
    return jsonResponse(400, { error: "Valid email is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  type ResolvedCandidate = {
    id: string;
    owner_user_id: string;
    is_active: boolean | null;
    created_at: string | null;
    email: string;
  };

  const candidatesById = new Map<string, ResolvedCandidate>();

  function upsertCandidate(row: MemberCandidate) {
    const id = String(row.id ?? "").trim();
    if (!id) return;
    candidatesById.set(id, {
      id,
      owner_user_id: String(row.owner_user_id ?? "").trim(),
      is_active: row.is_active ?? null,
      created_at: row.created_at ?? null,
      email: String(row.email ?? "").trim(),
    });
  }

  // Trainer-invitasjon sender eksplisitt memberId — rad kan mangle i e-postsøk (case/varianter), men må likevel prioriteres.
  if (memberId) {
    const { data: idRow, error: idErr } = await adminClient
      .from("members")
      .select("id, owner_user_id, is_active, created_at, email")
      .eq("id", memberId)
      .maybeSingle();
    if (idErr) {
      return jsonResponse(500, { error: `Could not load member by id: ${idErr.message}` });
    }
    if (idRow) {
      const typed = idRow as MemberCandidate;
      const rowEmail = normalizeEmail(typed.email);
      if (rowEmail && rowEmail !== email) {
        return jsonResponse(409, { error: "memberId does not match the invited email" });
      }
      upsertCandidate(typed);
    }
  }

  const { data: memberRows, error: memberLookupError } = await adminClient
    .from("members")
    .select("id, owner_user_id, is_active, created_at, email")
    .ilike("email", email);
  if (memberLookupError) {
    return jsonResponse(500, { error: `Could not resolve member by email: ${memberLookupError.message}` });
  }
  for (const row of memberRows ?? []) {
    upsertCandidate(row as MemberCandidate);
  }

  let candidates = [...candidatesById.values()];
  if (!candidates.length) {
    const { data: allMembers, error: allMembersError } = await adminClient
      .from("members")
      .select("id, owner_user_id, is_active, created_at, email");
    if (allMembersError) {
      return jsonResponse(500, { error: `Could not scan members by normalized email: ${allMembersError.message}` });
    }
    for (const row of allMembers ?? []) {
      const typed = row as MemberCandidate;
      const rowEmail = normalizeEmail(typed.email);
      if (rowEmail !== email) continue;
      upsertCandidate(typed);
    }
    candidates = [...candidatesById.values()];
  }
  if (!candidates.length) {
    const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) {
      return jsonResponse(500, { error: `Could not list auth users: ${listError.message}` });
    }
    const users = listData?.users ?? [];
    const matchedUser = users.find((user) => normalizeEmail(user.email) === email);
    if (!matchedUser) {
      return jsonResponse(404, { error: "No member row found for email" });
    }
    const fallbackId = memberId || String(matchedUser.user_metadata?.member_id ?? "").trim() || matchedUser.id;
    const fallbackName =
      String(matchedUser.user_metadata?.full_name ?? matchedUser.user_metadata?.name ?? "").trim() || firstNameFromEmail(email);
    const { error: upsertError } = await adminClient.from("members").upsert(
      {
        id: fallbackId,
        owner_user_id: matchedUser.id,
        name: fallbackName,
        email,
        is_active: true,
        membership_type: "Standard",
        customer_type: "Medlem",
        days_since_activity: "0",
        goal: "",
        focus: "",
        personal_goals: "",
        injuries: "",
        coach_notes: "",
      },
      { onConflict: "id" },
    );
    if (upsertError) {
      return jsonResponse(500, { error: `Could not create member row: ${upsertError.message}` });
    }
    upsertCandidate({
      id: fallbackId,
      owner_user_id: bootstrapOwnerUserId ?? "",
      is_active: true,
      created_at: null,
      email,
    });
    candidates = [...candidatesById.values()];
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

  const requestedCandidate = memberId ? candidates.find((candidate) => candidate.id === memberId) : null;
  if (!requestedCandidate) {
    const candidateOwnerIds = Array.from(
      new Set(candidates.map((candidate) => String(candidate.owner_user_id ?? "").trim()).filter(Boolean)),
    );
    if (candidateOwnerIds.length > 1) {
      return jsonResponse(409, {
        error: "Refusing to auto-link member auth across multiple trainer owners",
        updated: 0,
        ownerCount: candidateOwnerIds.length,
      });
    }
  }

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

  // Respect explicitly requested member row when provided and valid.
  const selectedCandidate = requestedCandidate ?? canonicalCandidate ?? null;
  memberId = (selectedCandidate?.id || "").trim();
  if (!memberId) {
    return jsonResponse(404, { error: "No member row found for email" });
  }
  const canonicalOwnerUserId = String(selectedCandidate?.owner_user_id ?? "").trim();

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

  const trainerUsers = targetUsers.filter((user) => {
    const appRole = String(user.app_metadata?.role ?? "").trim().toLowerCase();
    const userRole = String(user.user_metadata?.role ?? "").trim().toLowerCase();
    return appRole === "trainer" || userRole === "trainer";
  });
  if (trainerUsers.length > 0) {
    return jsonResponse(409, {
      error: "Refusing to link trainer auth user as member",
      updated: 0,
      trainerEmails: trainerUsers.map((user) => String(user.email ?? "").trim()).filter(Boolean),
    });
  }

  let updated = 0;
  const legacyMemberIds = new Set<string>(
    candidates.map((candidate) => candidate.id).filter((id) => id && id !== memberId),
  );
  // Legacy: some rows stored member_id as email string.
  legacyMemberIds.add(email);
  for (const user of targetUsers) {
    const authUserId = String(user.id ?? "").trim();
    if (authUserId) {
      const { data: ownerRows, error: ownerRowsError } = await adminClient
        .from("members")
        .select("id")
        .eq("owner_user_id", authUserId);
      if (ownerRowsError) {
        console.warn(`link-member-auth: owner member lookup failed for ${authUserId}:`, ownerRowsError.message);
      } else {
        for (const row of ownerRows ?? []) {
          const id = String((row as { id?: string }).id ?? "").trim();
          if (id && id !== memberId) legacyMemberIds.add(id);
        }
      }
    }
    if (authUserId && authUserId !== memberId) {
      legacyMemberIds.add(authUserId);
      legacyMemberIds.add(`auth-${authUserId}`);
    }
    const appMetaMemberId = String((user.app_metadata?.member_id as string | undefined) ?? "").trim();
    if (appMetaMemberId && appMetaMemberId !== memberId) {
      legacyMemberIds.add(appMetaMemberId);
    }
    const userMetaMemberId = String((user.user_metadata?.member_id as string | undefined) ?? "").trim();
    if (userMetaMemberId && userMetaMemberId !== memberId) {
      legacyMemberIds.add(userMetaMemberId);
    }

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

  // Normalize historical rows that may still point to legacy ids, so member data resolves consistently.
  let migratedPrograms = 0;
  let migratedLogs = 0;
  let migratedMessages = 0;
  const legacyProgramCounts: Record<string, number> = {};
  for (const legacyId of legacyMemberIds) {
    const normalizedLegacyId = String(legacyId ?? "").trim();
    if (!normalizedLegacyId || normalizedLegacyId === memberId) continue;
    const { count: programCountBefore } = await adminClient
      .from("training_programs")
      .select("id", { count: "exact", head: true })
      .eq("member_id", normalizedLegacyId);
    legacyProgramCounts[normalizedLegacyId] = Number(programCountBefore ?? 0);

    let programUpdate = adminClient
      .from("training_programs")
      .update({ member_id: memberId })
      .eq("member_id", normalizedLegacyId);
    if (canonicalOwnerUserId) {
      programUpdate = programUpdate.eq("owner_user_id", canonicalOwnerUserId);
    }
    const { data: programRows, error: programUpdateError } = await programUpdate.select("id");
    if (programUpdateError) {
      console.warn(`link-member-auth: program member_id migrate failed for ${normalizedLegacyId}:`, programUpdateError.message);
    } else {
      migratedPrograms += (programRows ?? []).length;
    }

    let logUpdate = adminClient
      .from("workout_logs")
      .update({ member_id: memberId })
      .eq("member_id", normalizedLegacyId);
    if (canonicalOwnerUserId) {
      logUpdate = logUpdate.eq("owner_user_id", canonicalOwnerUserId);
    }
    const { data: logRows, error: logUpdateError } = await logUpdate.select("id");
    if (logUpdateError) {
      console.warn(`link-member-auth: workout_log member_id migrate failed for ${normalizedLegacyId}:`, logUpdateError.message);
    } else {
      migratedLogs += (logRows ?? []).length;
    }

    let messageUpdate = adminClient
      .from("chat_messages")
      .update({ member_id: memberId })
      .eq("member_id", normalizedLegacyId);
    if (canonicalOwnerUserId) {
      messageUpdate = messageUpdate.eq("owner_user_id", canonicalOwnerUserId);
    }
    const { data: messageRows, error: messageUpdateError } = await messageUpdate.select("id");
    if (messageUpdateError) {
      console.warn(`link-member-auth: chat_message member_id migrate failed for ${normalizedLegacyId}:`, messageUpdateError.message);
    } else {
      migratedMessages += (messageRows ?? []).length;
    }
  }
  const { count: canonicalProgramCount } = await adminClient
    .from("training_programs")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId);
  const { count: emailLikeProgramCount } = await adminClient
    .from("training_programs")
    .select("id", { count: "exact", head: true })
    .ilike("member_id", `%${email}%`);

  // Guarded rescue: if canonical has zero programs and owner has exactly one foreign member_id bucket,
  // migrate that bucket to canonical member_id.
  let rescuedPrograms = 0;
  if (Number(canonicalProgramCount ?? 0) === 0 && canonicalOwnerUserId) {
    const { data: ownerPrograms, error: ownerProgramsError } = await adminClient
      .from("training_programs")
      .select("id, member_id")
      .eq("owner_user_id", canonicalOwnerUserId);
    if (ownerProgramsError) {
      console.warn(`link-member-auth: owner program rescue lookup failed:`, ownerProgramsError.message);
    } else {
      const grouped = new Map<string, number>();
      for (const row of ownerPrograms ?? []) {
        const pid = String((row as { member_id?: string }).member_id ?? "").trim();
        if (!pid || pid === memberId) continue;
        grouped.set(pid, (grouped.get(pid) ?? 0) + 1);
      }
      if (grouped.size === 1) {
        const [onlyLegacyId] = Array.from(grouped.keys());
        const { data: rescuedRows, error: rescueError } = await adminClient
          .from("training_programs")
          .update({ member_id: memberId })
          .eq("owner_user_id", canonicalOwnerUserId)
          .eq("member_id", onlyLegacyId)
          .select("id");
        if (rescueError) {
          console.warn(`link-member-auth: owner program rescue update failed:`, rescueError.message);
        } else {
          rescuedPrograms = (rescuedRows ?? []).length;
        }
      }
    }
  }

  // Explicit one-off rescue path when caller knows orphan source member_id.
  let explicitSourcePrograms = 0;
  let explicitSourceLogs = 0;
  let explicitSourceMessages = 0;
  if (sourceMemberId && sourceMemberId !== memberId) {
    const programUpdate = adminClient
      .from("training_programs")
      .update({ member_id: memberId })
      .eq("member_id", sourceMemberId);
    const logUpdate = adminClient
      .from("workout_logs")
      .update({ member_id: memberId })
      .eq("member_id", sourceMemberId);
    const messageUpdate = adminClient
      .from("chat_messages")
      .update({ member_id: memberId })
      .eq("member_id", sourceMemberId);
    const scopedProgramUpdate = sourceOwnerUserId ? programUpdate.eq("owner_user_id", sourceOwnerUserId) : programUpdate;
    const scopedLogUpdate = sourceOwnerUserId ? logUpdate.eq("owner_user_id", sourceOwnerUserId) : logUpdate;
    const scopedMessageUpdate = sourceOwnerUserId ? messageUpdate.eq("owner_user_id", sourceOwnerUserId) : messageUpdate;

    const { data: movedPrograms, error: movedProgramsError } = await scopedProgramUpdate.select("id");
    if (movedProgramsError) {
      console.warn("link-member-auth: explicit source program migrate failed:", movedProgramsError.message);
    } else {
      explicitSourcePrograms = (movedPrograms ?? []).length;
    }
    const { data: movedLogs, error: movedLogsError } = await scopedLogUpdate.select("id");
    if (movedLogsError) {
      console.warn("link-member-auth: explicit source log migrate failed:", movedLogsError.message);
    } else {
      explicitSourceLogs = (movedLogs ?? []).length;
    }
    const { data: movedMessages, error: movedMessagesError } = await scopedMessageUpdate.select("id");
    if (movedMessagesError) {
      console.warn("link-member-auth: explicit source message migrate failed:", movedMessagesError.message);
    } else {
      explicitSourceMessages = (movedMessages ?? []).length;
    }
  }

  return jsonResponse(200, {
    message: "Auth member link synced",
    updated,
    canonicalMemberId: memberId,
    migratedPrograms,
    migratedLogs,
    migratedMessages,
    migratedFromIds: Array.from(legacyMemberIds),
    debug: {
      legacyProgramCounts,
      canonicalProgramCount: Number(canonicalProgramCount ?? 0),
      emailLikeProgramCount: Number(emailLikeProgramCount ?? 0),
      rescuedPrograms,
      canonicalOwnerUserId,
      explicitSourceMemberId: sourceMemberId || null,
      explicitSourceOwnerUserId: sourceOwnerUserId || null,
      explicitSourcePrograms,
      explicitSourceLogs,
      explicitSourceMessages,
    },
  });
});

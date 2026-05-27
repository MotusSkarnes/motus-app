import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UpdatePayload = {
  email?: string;
  emails?: string[];
  memberId?: string;
  memberIds?: string[];
  targetName?: string;
  changes?: {
    name?: string;
    phone?: string;
    birthDate?: string;
    goal?: string;
    focus?: string;
    injuries?: string;
    /** Encoded profile metrics / app metadata; see MemberPortal MOTUS_PROFILE_V1 */
    personalGoals?: string;
    avatarUrl?: string;
    /** Trainer-only; applied server-side only when JWT role is trainer */
    membershipType?: string;
    customerType?: string;
    /** ISO 8601 — trener setter invitasjonstidspunkt */
    invitedAt?: string;
    /** Trener aktiverer kosthold/ernæring for medlem */
    nutritionAccess?: boolean;
  };
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

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function isValidCalendarDate(day: number, month: number, year: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function normalizeBirthDate(value: unknown): string | null {
  const trimmed = normalizeString(value);
  if (!trimmed) return "";
  const dotted = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotted) {
    const day = Number(dotted[1]);
    const month = Number(dotted[2]);
    const year = Number(dotted[3]);
    return isValidCalendarDate(day, month, year) ? trimmed : null;
  }
  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    if (!isValidCalendarDate(day, month, year)) return null;
    return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
  }
  return null;
}

function isSharedMedlem(customerType: unknown): boolean {
  return normalizeString(customerType).toLowerCase() === "medlem";
}

function isTrainerStaffEmail(email: string): boolean {
  return normalizeEmail(email).endsWith("@motus-skarnes.no");
}

function readAuthMemberId(user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): string {
  return normalizeString(
    (user.app_metadata?.member_id as string | undefined) ??
      (user.user_metadata?.member_id as string | undefined) ??
      "",
  );
}

/** Staff som PT-kunde (member_id i JWT) skal lagre som medlem, ikke trener. */
function resolveEndpointUserRole(user: {
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): string {
  const currentEmail = normalizeEmail(user.email);
  const appRole = normalizeString(user.app_metadata?.role).toLowerCase();
  const metaRole = normalizeString(user.user_metadata?.role).toLowerCase();
  if (appRole === "member" || metaRole === "member") return "member";
  const linkedMemberId = readAuthMemberId(user);
  if (isTrainerStaffEmail(currentEmail) && linkedMemberId) return "member";
  if (appRole === "trainer" || metaRole === "trainer") return "trainer";
  if (isTrainerStaffEmail(currentEmail)) return "trainer";
  return appRole || metaRole || "";
}

function withoutAvatarUrl(fields: Record<string, string>): Record<string, string> {
  const next = { ...fields };
  delete next.avatar_url;
  return next;
}

function isMissingAvatarColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("avatar_url") && (lower.includes("schema cache") || lower.includes("column"));
}

async function updateMembersById(
  adminClient: ReturnType<typeof createClient>,
  fields: Record<string, string | boolean>,
  ids: string[],
) {
  if (!ids.length) return { data: [] as { id?: string }[], error: null as null };
  let result = await adminClient.from("members").update(fields).in("id", ids).select("id");
  if (result.error && isMissingAvatarColumnError(result.error.message) && "avatar_url" in fields) {
    result = await adminClient.from("members").update(withoutAvatarUrl(fields)).in("id", ids).select("id");
  }
  return result;
}

function canTrainerEditAnchor(row: { owner_user_id?: string | null; customer_type?: string | null }, trainerUserId: string): boolean {
  const ownerUserId = normalizeString(row.owner_user_id);
  if (isSharedMedlem(row.customer_type)) return true;
  // Eldre PT-rader kan mangle owner_user_id til auth-id er satt — da skal eier-PT fortsatt kunne oppdatere typen.
  if (!ownerUserId) return true;
  return ownerUserId === trainerUserId;
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
    return jsonResponse(500, { error: "Missing Supabase environment variables" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse(401, { error: "Missing bearer token" });
  }

  let payload: UpdatePayload;
  try {
    payload = (await req.json()) as UpdatePayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const userClient = createClient(supabaseUrl, serviceRoleKey);
  const {
    data,
    error: userError,
  } = await userClient.auth.getUser(token);
  const user = data?.user ?? null;
  if (userError || !user) {
    return jsonResponse(401, { error: "Invalid user session" });
  }

  const currentEmail = normalizeEmail(user.email);
  const userRole = resolveEndpointUserRole(user);
  // Some existing auth users may be missing explicit role metadata.
  // Authorization is still enforced by validating authenticated email below.
  if (userRole && userRole !== "member" && userRole !== "trainer") {
    return jsonResponse(403, { error: "Only members/trainers can update profile through this endpoint" });
  }

  const requestedEmail = normalizeEmail(payload.email);
  const requestedEmails = Array.isArray(payload.emails)
    ? payload.emails.map((value) => normalizeEmail(value)).filter((value) => value && value.includes("@"))
    : [];
  const requestedMemberId = normalizeString(payload.memberId);
  const requestedMemberIds = Array.isArray(payload.memberIds)
    ? payload.memberIds.map((value) => normalizeString(value)).filter(Boolean)
    : [];
  const authMemberId = readAuthMemberId(user);
  if (!currentEmail || !currentEmail.includes("@")) {
    return jsonResponse(400, { error: "Logged-in user is missing a valid email" });
  }
  if (userRole === "member" && requestedEmail && requestedEmail !== currentEmail) {
    if (!requestedEmails.includes(currentEmail)) {
      return jsonResponse(403, { error: "Email mismatch for member profile update" });
    }
  }

  const changes = payload.changes ?? {};
  const targetEmailForUpdate = requestedEmail || currentEmail;
  const normalizedBirthDate =
    changes.birthDate !== undefined ? normalizeBirthDate(changes.birthDate) : undefined;
  if (normalizedBirthDate === null) {
    return jsonResponse(400, { error: "Fødselsdato må være en gyldig dato på formatet dd.mm.yyyy." });
  }
  // Email is an identity/routing key here, not a profile field. Never rewrite an
  // existing member row's email from this endpoint; stale auth member_id metadata
  // can otherwise overwrite an unrelated member with the logged-in user's email.
  const updateFields: Record<string, string | boolean> = {};
  if (changes.name !== undefined) updateFields.name = normalizeString(changes.name);
  if (changes.phone !== undefined) updateFields.phone = normalizeString(changes.phone);
  if (normalizedBirthDate !== undefined) updateFields.birth_date = normalizedBirthDate;
  if (changes.goal !== undefined) updateFields.goal = normalizeString(changes.goal);
  if (changes.focus !== undefined) updateFields.focus = normalizeString(changes.focus);
  if (changes.injuries !== undefined) updateFields.injuries = normalizeString(changes.injuries);
  if (changes.personalGoals !== undefined) updateFields.personal_goals = normalizeString(changes.personalGoals);
  const avatarUrl = normalizeString(changes.avatarUrl);
  if (avatarUrl) updateFields.avatar_url = avatarUrl;

  // Membership / customer type: ikke for medlem-session; trener eller JWT uten role (eldre trener-kontoer).
  const canEditMembershipFields = userRole === "trainer" || userRole === "";
  if (canEditMembershipFields) {
    if (changes.membershipType !== undefined) {
      const mt = normalizeString(changes.membershipType).toLowerCase();
      if (mt === "premium") updateFields.membership_type = "Premium";
      else if (mt === "standard") updateFields.membership_type = "Standard";
    }
    if (changes.customerType !== undefined) {
      const ct = normalizeString(changes.customerType);
      const allowedCustomer = new Set(["PT-kunde", "Medlem", "Oppfølging", "Egentrening"]);
      if (allowedCustomer.has(ct)) updateFields.customer_type = ct;
    }
    if (changes.invitedAt !== undefined) {
      const iso = normalizeString(changes.invitedAt);
      if (iso) updateFields.invited_at = iso;
    }
    if (changes.nutritionAccess !== undefined) {
      updateFields.nutrition_access = changes.nutritionAccess === true;
    }
  }

  const profileUpdateFields: Record<string, string | boolean> = { ...updateFields };
  const rosterUpdateFields: Record<string, string | boolean> = {};
  if (profileUpdateFields.membership_type !== undefined) {
    rosterUpdateFields.membership_type = profileUpdateFields.membership_type;
    delete profileUpdateFields.membership_type;
  }
  if (profileUpdateFields.customer_type !== undefined) {
    rosterUpdateFields.customer_type = profileUpdateFields.customer_type;
    delete profileUpdateFields.customer_type;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  // PostgREST `.or('email.eq.foo@bar.com')` breaks on dots in values — resolve anchors by id + in-memory email match.
  const anchorIdCandidates = Array.from(
    new Set(
      [authMemberId, requestedMemberId, ...requestedMemberIds]
        .map((value) => normalizeString(value))
        .filter(Boolean),
    ),
  );
  let anchorRows: Array<{ id: string; email: string; owner_user_id: string | null; customer_type: string | null }> = [];
  if (anchorIdCandidates.length) {
    const { data: byIdRows, error: byIdError } = await adminClient
      .from("members")
      .select("id,email,name,owner_user_id,customer_type")
      .in("id", anchorIdCandidates);
    if (byIdError) {
      return jsonResponse(500, { error: `Could not resolve member anchors by id: ${byIdError.message}` });
    }
    anchorRows = (byIdRows ?? []) as Array<{ id: string; email: string; owner_user_id: string | null; customer_type: string | null }>;
  }

  const visibleAnchors = (anchorRows ?? []).filter((row) => {
    if (userRole !== "trainer") {
      const rowEmail = normalizeEmail(row.email);
      const rowId = normalizeString(row.id);
      if (rowId && (rowId === authMemberId || rowId === user.id)) return true;
      return rowEmail === currentEmail || requestedEmails.includes(rowEmail);
    }
    return canTrainerEditAnchor(
      row as { owner_user_id?: string | null; customer_type?: string | null },
      user.id,
    );
  });

  const normalizedTargetEmails = new Set<string>(
    [targetEmailForUpdate, currentEmail, ...requestedEmails].map((value) => normalizeEmail(value)).filter(Boolean),
  );
  let expandedRows: Array<{ id: string; email: string; owner_user_id: string | null; customer_type: string | null }> = [];
  if (normalizedTargetEmails.size) {
    // Legacy data can contain casing/whitespace variants in email, so do a broad fetch
    // and normalize in-memory to find all duplicates that should sync together.
    // Never match by display name — common names (e.g. "Emil") would overwrite unrelated members.
    const { data: allRows, error: allRowsError } = await adminClient
      .from("members")
      .select("id,email,name,owner_user_id,customer_type");
    if (allRowsError) {
      return jsonResponse(500, { error: `Could not expand member targets: ${allRowsError.message}` });
    }
    expandedRows = (allRows ?? []).filter((row) => {
      const rowEmail = normalizeEmail(row.email);
      return Boolean(rowEmail && normalizedTargetEmails.has(rowEmail));
    });
  }
  const visibleExpandedRows = expandedRows.filter((row) => {
    if (userRole !== "trainer") return true;
    if (!visibleAnchors.length) return false;
    return canTrainerEditAnchor(
      row as { owner_user_id?: string | null; customer_type?: string | null },
      user.id,
    );
  });

  const targetIds = Array.from(
    new Set(
      [...visibleAnchors, ...visibleExpandedRows]
        .map((row) => normalizeString(row.id))
        .filter(Boolean),
    ),
  );
  const targetEmails = Array.from(
    new Set(
      [targetEmailForUpdate, ...requestedEmails, ...visibleAnchors.map((row) => normalizeEmail(row.email)), ...visibleExpandedRows.map((row) => normalizeEmail(row.email))]
        .filter((value) => value && value.includes("@"))
    )
  );
  if (!targetIds.length && !targetEmails.length) {
    if (isTrainerStaffEmail(currentEmail) && userRole === "trainer" && !authMemberId) {
      return jsonResponse(403, {
        error: "Trainer accounts cannot bootstrap a member profile row from this endpoint.",
      });
    }
    // Last-resort bootstrap for missing member row: create one tied to auth user.
    const fallbackMemberId = authMemberId || requestedMemberId || `member-${crypto.randomUUID().slice(0, 8)}`;
    const insertPayload: Record<string, unknown> = {
      id: fallbackMemberId,
      owner_user_id: user.id,
      email: currentEmail,
      is_active: true,
      customer_type: "Medlem",
      membership_type: "Standard",
      days_since_activity: "0",
      name: normalizeString(changes.name) || normalizeString((user.user_metadata?.full_name as string | undefined) ?? user.email),
      phone: normalizeString(changes.phone),
      birth_date: normalizedBirthDate ?? "",
      goal: normalizeString(changes.goal),
      focus: normalizeString(changes.focus),
      injuries: normalizeString(changes.injuries),
      personal_goals: normalizeString(changes.personalGoals),
    };
    if (avatarUrl) insertPayload.avatar_url = avatarUrl;
    let bootstrapResult = await adminClient.from("members").upsert(insertPayload, { onConflict: "id" }).select("id");
    if (bootstrapResult.error && isMissingAvatarColumnError(bootstrapResult.error.message) && "avatar_url" in insertPayload) {
      const { avatar_url: _removed, ...bootstrapWithoutAvatar } = insertPayload;
      bootstrapResult = await adminClient.from("members").upsert(bootstrapWithoutAvatar, { onConflict: "id" }).select("id");
    }
    if (bootstrapResult.error) {
      return jsonResponse(500, { error: `Could not bootstrap member row: ${bootstrapResult.error.message}` });
    }
    return jsonResponse(200, { message: "Member profile synced (bootstrapped)", updated: bootstrapResult.data?.length ?? 0 });
  }

  const updatedIds = new Set<string>();
  const mergeUpdated = (rows: unknown) => {
    (rows ?? []).forEach((row) => {
      const id = normalizeString((row as { id?: string }).id);
      if (id) updatedIds.add(id);
    });
  };

  const hasProfileUpdates = Object.keys(profileUpdateFields).length > 0;
  if (hasProfileUpdates && targetIds.length) {
    const byIdResult = await updateMembersById(adminClient, profileUpdateFields, targetIds);
    if (byIdResult.error) {
      return jsonResponse(500, { error: `Could not update member rows by id: ${byIdResult.error.message}` });
    }
    mergeUpdated(byIdResult.data);
  }

  if (hasProfileUpdates && userRole === "trainer" && normalizedTargetEmails.size > 0) {
    const trainerId = user.id;
    const emailSet = new Set(Array.from(normalizedTargetEmails).filter((value) => value.includes("@")));
    const { data: allMemberRows, error: profileFanoutError } = await adminClient
      .from("members")
      .select("id,email,owner_user_id,customer_type");
    if (profileFanoutError) {
      return jsonResponse(500, { error: `Could not fan out profile fields: ${profileFanoutError.message}` });
    }
    const profileFanoutIds = Array.from(
      new Set(
        (allMemberRows ?? [])
          .filter((row) => {
            const rowEmail = normalizeEmail((row as { email?: string }).email);
            if (!rowEmail || !emailSet.has(rowEmail)) return false;
            if (isSharedMedlem((row as { customer_type?: string | null }).customer_type)) return true;
            return normalizeString((row as { owner_user_id?: string | null }).owner_user_id) === trainerId;
          })
          .map((row) => normalizeString((row as { id?: string }).id))
          .filter(Boolean),
      ),
    );
    if (profileFanoutIds.length) {
      const fanoutResult = await updateMembersById(adminClient, profileUpdateFields, profileFanoutIds);
      if (fanoutResult.error) {
        return jsonResponse(500, { error: `Could not fan out profile fields by email: ${fanoutResult.error.message}` });
      }
      mergeUpdated(fanoutResult.data);
    }
  }

  if (hasProfileUpdates && normalizedTargetEmails.size > 0 && userRole !== "trainer") {
    const emailMatchedIds = Array.from(
      new Set(
        expandedRows
          .map((row) => normalizeString(row.id))
          .filter(Boolean),
      ),
    );
    if (emailMatchedIds.length) {
      const byEmailIdsResult = await updateMembersById(adminClient, profileUpdateFields, emailMatchedIds);
      if (byEmailIdsResult.error) {
        return jsonResponse(500, { error: `Could not update member rows by email: ${byEmailIdsResult.error.message}` });
      }
      mergeUpdated(byEmailIdsResult.data);
    }
  }

  if (
    canEditMembershipFields &&
    changes.nutritionAccess !== undefined &&
    normalizedTargetEmails.size > 0
  ) {
    const nutritionFields = { nutrition_access: changes.nutritionAccess === true };
    const emailSet = new Set(Array.from(normalizedTargetEmails).filter((value) => value.includes("@")));
    const { data: allMemberRows, error: nutritionFanoutError } = await adminClient.from("members").select("id,email");
    if (nutritionFanoutError) {
      return jsonResponse(500, { error: `Could not fan out nutrition access: ${nutritionFanoutError.message}` });
    }
    const nutritionFanoutIds = Array.from(
      new Set(
        (allMemberRows ?? [])
          .filter((row) => {
            const rowEmail = normalizeEmail((row as { email?: string }).email);
            return Boolean(rowEmail && emailSet.has(rowEmail));
          })
          .map((row) => normalizeString((row as { id?: string }).id))
          .filter(Boolean),
      ),
    );
    if (nutritionFanoutIds.length) {
      const nutritionResult = await updateMembersById(adminClient, nutritionFields, nutritionFanoutIds);
      if (nutritionResult.error) {
        return jsonResponse(500, { error: `Could not update nutrition access: ${nutritionResult.error.message}` });
      }
      mergeUpdated(nutritionResult.data);
    }
  }

  if (canEditMembershipFields && Object.keys(rosterUpdateFields).length > 0) {
    const trainerId = user.id;
    const nextCustomerType = normalizeString(rosterUpdateFields.customer_type).toLowerCase();

    if (nextCustomerType === "medlem") {
      const rosterIds = Array.from(
        new Set(
          (requestedMemberIds.length ? requestedMemberIds : visibleAnchors.map((row) => normalizeString(row.id)))
            .map((value) => normalizeString(value))
            .filter(Boolean),
        ),
      );
      const ownedRosterIds = rosterIds.length
        ? visibleAnchors
            .filter((row) => rosterIds.includes(normalizeString(row.id)))
            .filter((row) => {
              const ownerUserId = normalizeString(row.owner_user_id);
              return ownerUserId === trainerId || !ownerUserId;
            })
            .map((row) => normalizeString(row.id))
            .filter(Boolean)
        : [];
      if (ownedRosterIds.length) {
        const medlemResult = await adminClient.from("members").update(rosterUpdateFields).in("id", ownedRosterIds).select("id");
        if (medlemResult.error) {
          return jsonResponse(500, { error: `Could not update shared medlem roster: ${medlemResult.error.message}` });
        }
        mergeUpdated(medlemResult.data);
      }
    } else {
      const rosterEditableIds = new Set(
        [...visibleAnchors, ...visibleExpandedRows]
          .filter((row) => {
            if (isSharedMedlem(row.customer_type)) return true;
            const ownerUserId = normalizeString(row.owner_user_id);
            return ownerUserId === trainerId || !ownerUserId;
          })
          .map((row) => normalizeString(row.id))
          .filter(Boolean),
      );
      let rosterIds = requestedMemberIds.length
        ? requestedMemberIds.map((value) => normalizeString(value)).filter((id) => rosterEditableIds.has(id))
        : Array.from(rosterEditableIds);
      rosterIds = Array.from(new Set(rosterIds));
      if (!rosterIds.length && requestedMemberIds.length) {
        rosterIds = Array.from(
          new Set(requestedMemberIds.map((value) => normalizeString(value)).filter(Boolean)),
        );
      }
      if (rosterIds.length) {
        const privateRosterPayload = {
          ...rosterUpdateFields,
          owner_user_id: trainerId,
        };
        const rosterResult = await adminClient.from("members").update(privateRosterPayload).in("id", rosterIds).select("id");
        if (rosterResult.error) {
          return jsonResponse(500, { error: `Could not update roster fields: ${rosterResult.error.message}` });
        }
        mergeUpdated(rosterResult.data);
      }
    }
  }

  return jsonResponse(200, { message: "Member profile synced", updated: updatedIds.size });
});

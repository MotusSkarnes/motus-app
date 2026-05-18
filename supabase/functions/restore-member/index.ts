import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RestorePayload = {
  email?: string;
  ownerUserId?: string;
  lookupOnly?: boolean;
  /** Når true: overfør PT-kunde til innlogget trener (brukes av «Gjenopprett og knytt til meg»). */
  claimForTrainer?: boolean;
};

type MemberRow = {
  id?: string;
  email?: string | null;
  name?: string | null;
  is_active?: boolean | null;
  owner_user_id?: string | null;
  customer_type?: string | null;
};

type AuthUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function isSharedMedlem(customerType: string | null | undefined): boolean {
  return String(customerType ?? "").trim().toLowerCase() === "medlem";
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MEMBER_SELECT = "id, email, name, is_active, owner_user_id, customer_type";

async function listMembersByEmail(adminClient: ReturnType<typeof createClient>, email: string): Promise<MemberRow[]> {
  const { data: rows, error: fetchError } = await adminClient
    .from("members")
    .select(MEMBER_SELECT)
    .ilike("email", email);
  if (fetchError) {
    throw new Error(fetchError.message);
  }
  return (rows ?? []).filter((row) => normalizeEmail(String((row as MemberRow).email ?? "")) === email) as MemberRow[];
}

async function findAuthUserByEmail(adminClient: ReturnType<typeof createClient>, email: string): Promise<AuthUser | null> {
  const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    throw new Error(`Kunne ikke slå opp Auth-bruker: ${listError.message}`);
  }
  const matched = (listData?.users ?? []).find((user) => normalizeEmail(user.email) === email);
  if (!matched?.id) return null;
  return matched as AuthUser;
}

async function fetchMemberById(adminClient: ReturnType<typeof createClient>, memberId: string): Promise<MemberRow | null> {
  const trimmed = memberId.trim();
  if (!trimmed) return null;
  const { data: row, error } = await adminClient.from("members").select(MEMBER_SELECT).eq("id", trimmed).maybeSingle();
  if (error) throw new Error(error.message);
  return row ? (row as MemberRow) : null;
}

async function migrateMemberDataToTrainer(
  adminClient: ReturnType<typeof createClient>,
  memberIds: string[],
  ownerUserId: string,
): Promise<void> {
  const ids = Array.from(new Set(memberIds.map((id) => id.trim()).filter(Boolean)));
  const owner = ownerUserId.trim();
  if (!ids.length || !owner) return;
  for (const table of ["training_programs", "workout_logs", "chat_messages"] as const) {
    const { error } = await adminClient.from(table).update({ owner_user_id: owner }).in("member_id", ids);
    if (error) {
      console.warn(`restore-member: could not migrate ${table}.owner_user_id:`, error.message);
    }
  }
}

async function syncAuthMemberId(adminClient: ReturnType<typeof createClient>, authUser: AuthUser, memberId: string): Promise<void> {
  const trimmedMemberId = memberId.trim();
  if (!trimmedMemberId) return;
  const appMetadata =
    authUser.app_metadata && typeof authUser.app_metadata === "object"
      ? (authUser.app_metadata as Record<string, unknown>)
      : {};
  const userMetadata =
    authUser.user_metadata && typeof authUser.user_metadata === "object"
      ? (authUser.user_metadata as Record<string, unknown>)
      : {};
  const { error } = await adminClient.auth.admin.updateUserById(authUser.id, {
    app_metadata: { ...appMetadata, role: "member", member_id: trimmedMemberId },
    user_metadata: { ...userMetadata, role: "member", member_id: trimmedMemberId },
  });
  if (error) {
    throw new Error(`Kunne ikke oppdatere Auth-kobling: ${error.message}`);
  }
}

function displayNameFromAuth(authUser: AuthUser, email: string): string {
  const meta = authUser.user_metadata ?? {};
  const full = String(meta.full_name ?? meta.name ?? "").trim();
  if (full) return full;
  const local = email.split("@")[0] ?? "";
  return local.replace(/[._-]+/g, " ").trim() || "Medlem";
}

/** Når members.email er overskrevet, finnes raden via auth member_id — kan peke på feil person. */
async function listMembersByAuthLoginEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string,
): Promise<{ rows: MemberRow[]; authUser: AuthUser | null; emailMismatch: boolean }> {
  const authUser = await findAuthUserByEmail(adminClient, email);
  if (!authUser) return { rows: [], authUser: null, emailMismatch: false };

  const metadataMemberId =
    String(authUser.app_metadata?.member_id ?? "").trim() ||
    String(authUser.user_metadata?.member_id ?? "").trim();
  if (!metadataMemberId) {
    return { rows: [], authUser, emailMismatch: false };
  }

  const row = await fetchMemberById(adminClient, metadataMemberId);
  if (!row) return { rows: [], authUser, emailMismatch: false };

  const rowEmail = normalizeEmail(row.email);
  const emailMismatch = rowEmail !== email;
  return { rows: [row], authUser, emailMismatch };
}

async function resolveMembersForLoginEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string,
): Promise<{ rows: MemberRow[]; authUser: AuthUser | null; emailMismatch: boolean }> {
  const byEmail = await listMembersByEmail(adminClient, email);
  if (byEmail.length) return { rows: byEmail, authUser: null, emailMismatch: false };
  return listMembersByAuthLoginEmail(adminClient, email);
}

async function upsertMemberRow(
  adminClient: ReturnType<typeof createClient>,
  row: {
    id: string;
    email: string;
    name: string;
    ownerUserId: string;
    customerType?: string;
    isActive?: boolean;
  },
): Promise<MemberRow> {
  const { error: upsertError } = await adminClient.from("members").upsert(
    {
      id: row.id,
      owner_user_id: row.ownerUserId || null,
      name: row.name,
      email: row.email,
      is_active: row.isActive !== false,
      membership_type: "Standard",
      customer_type: row.customerType ?? "PT-kunde",
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
    throw new Error(`Kunne ikke lagre medlemsrad: ${upsertError.message}`);
  }
  const saved = await fetchMemberById(adminClient, row.id);
  if (!saved) {
    throw new Error("Medlemsrad ble ikke funnet etter lagring.");
  }
  return saved;
}

/** Opprett/knytt egen medlemsrad for innlogging — ikke overskriv feil koblet rad. */
async function relinkAuthLoginToDedicatedMemberRow(
  adminClient: ReturnType<typeof createClient>,
  email: string,
  ownerUserId: string,
  authUser: AuthUser,
  claimForTrainer: boolean,
): Promise<MemberRow> {
  const byEmail = await listMembersByEmail(adminClient, email);
  if (byEmail.length) {
    const row = byEmail[0] as MemberRow;
    const id = String(row.id ?? "").trim();
    if (id) {
      const patch = buildMemberRestorePatch(row, email, ownerUserId, claimForTrainer);
      await adminClient.from("members").update(patch).eq("id", id);
      if (claimForTrainer && ownerUserId) {
        await migrateMemberDataToTrainer(adminClient, [id], ownerUserId);
      }
      await syncAuthMemberId(adminClient, authUser, id);
      const updated = await fetchMemberById(adminClient, id);
      return updated ?? row;
    }
  }

  const canonicalMemberId = String(authUser.id).trim();
  const name = displayNameFromAuth(authUser, email);
  const saved = await upsertMemberRow(adminClient, {
    id: canonicalMemberId,
    email,
    name,
    ownerUserId,
    customerType: "PT-kunde",
    isActive: true,
  });
  await syncAuthMemberId(adminClient, authUser, canonicalMemberId);
  return saved;
}

async function recreateMemberFromAuth(
  adminClient: ReturnType<typeof createClient>,
  email: string,
  ownerUserId: string,
): Promise<MemberRow | null> {
  const authUser = await findAuthUserByEmail(adminClient, email);
  if (!authUser) return null;
  return relinkAuthLoginToDedicatedMemberRow(adminClient, email, ownerUserId, authUser, true);
}

function buildMemberRestorePatch(
  row: MemberRow,
  loginEmail: string,
  ownerUserId: string,
  claimForTrainer: boolean,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { is_active: true };
  const rowEmail = normalizeEmail(row.email);
  // Never overwrite another customer's email (e.g. ruudlene@gmail.com → resepsjon@motus-skarnes.no).
  if (rowEmail !== loginEmail && !rowEmail) {
    patch.email = loginEmail;
  }
  if (!ownerUserId || isSharedMedlem(row.customer_type)) {
    return patch;
  }
  const currentOwner = String(row.owner_user_id ?? "").trim();
  if (claimForTrainer) {
    patch.owner_user_id = ownerUserId;
    patch.customer_type = "PT-kunde";
  } else if (!currentOwner || currentOwner === ownerUserId) {
    patch.owner_user_id = ownerUserId;
  }
  if (!String(row.customer_type ?? "").trim()) {
    patch.customer_type = "PT-kunde";
  }
  return patch;
}

function mapMemberForResponse(row: MemberRow, loginEmail: string, emailMismatch: boolean) {
  const rowEmail = normalizeEmail(row.email);
  return {
    id: String(row.id ?? ""),
    email: rowEmail,
    loginEmail,
    emailMismatch,
    linkedMemberEmail: rowEmail,
    name: String(row.name ?? "").trim(),
    isActive: row.is_active !== false,
    ownerUserId: String(row.owner_user_id ?? "").trim(),
    customerType: String(row.customer_type ?? "").trim(),
  };
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

  let payload: RestorePayload;
  try {
    payload = (await req.json()) as RestorePayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const email = normalizeEmail(payload.email);
  const ownerUserId = String(payload.ownerUserId ?? "").trim();
  const lookupOnly = payload.lookupOnly === true;
  const claimForTrainer = payload.claimForTrainer === true;
  if (!email || !email.includes("@")) {
    return jsonResponse(400, { error: "Valid email is required" });
  }
  if (!lookupOnly && !ownerUserId) {
    return jsonResponse(400, { error: "ownerUserId is required for restore" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const resolved = await resolveMembersForLoginEmail(adminClient, email);
    let matchingRows = resolved.rows;
    let emailMismatch = resolved.emailMismatch;
    let recreated = false;

    if (!matchingRows.length && ownerUserId && !lookupOnly) {
      const recreatedRow = await recreateMemberFromAuth(adminClient, email, ownerUserId);
      if (recreatedRow) {
        matchingRows = [recreatedRow];
        emailMismatch = false;
        recreated = true;
      }
    }

    if (!matchingRows.length) {
      return jsonResponse(404, {
        error: "Ingen klient funnet med denne e-posten",
        email,
        lookupOnly,
      });
    }

    if (lookupOnly) {
      const message = emailMismatch
        ? `Innloggingen er ${email}, men medlemsraden har e-post ${normalizeEmail(matchingRows[0]?.email)}. Bruk «Gjenopprett» for å koble riktig.`
        : `Fant ${matchingRows.length} rad${matchingRows.length === 1 ? "" : "er"} i databasen.`;
      return jsonResponse(200, {
        email,
        lookupOnly: true,
        emailMismatch,
        members: matchingRows.map((row) => mapMemberForResponse(row, email, emailMismatch)),
        message,
      });
    }

    if (emailMismatch && resolved.authUser && ownerUserId) {
      const relinked = await relinkAuthLoginToDedicatedMemberRow(
        adminClient,
        email,
        ownerUserId,
        resolved.authUser,
        claimForTrainer,
      );
      return jsonResponse(200, {
        message: "Klient koblet på nytt med riktig e-post",
        restoredCount: 1,
        reactivatedCount: relinked.is_active === false ? 1 : 0,
        recreated: false,
        relinked: true,
        memberIds: [String(relinked.id ?? "")],
      });
    }

    const restoredIds: string[] = [];
    for (const row of matchingRows) {
      const id = String(row.id ?? "").trim();
      if (!id) continue;
      const rowEmail = normalizeEmail(row.email);
      if (rowEmail && rowEmail !== email) {
        continue;
      }
      const patch = buildMemberRestorePatch(row, email, ownerUserId, claimForTrainer);
      const { error } = await adminClient.from("members").update(patch).eq("id", id);
      if (error) {
        return jsonResponse(500, { error: error.message, memberId: id });
      }
      if (resolved.authUser) {
        await syncAuthMemberId(adminClient, resolved.authUser, id);
      }
      restoredIds.push(id);
    }

    if (claimForTrainer && ownerUserId && restoredIds.length) {
      await migrateMemberDataToTrainer(adminClient, restoredIds, ownerUserId);
    }

    const reactivatedCount = matchingRows.filter((row) => row.is_active === false).length;
    return jsonResponse(200, {
      message: recreated ? "Member row recreated and restored" : "Member restored",
      restoredCount: restoredIds.length,
      reactivatedCount,
      recreated,
      claimedForTrainer: claimForTrainer && Boolean(ownerUserId),
      memberIds: restoredIds,
    });
  } catch (error) {
    return jsonResponse(500, { error: String(error) });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SendPayload = {
  memberId?: string;
  sender?: "trainer" | "member";
  text?: string;
  targetEmail?: string;
  targetName?: string;
  clientMessageId?: string;
};

async function resolveAuthUserByEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string,
): Promise<{ userId: string; memberId: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) return { userId: "", memberId: "" };
  let page = 1;
  for (let i = 0; i < 10; i += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) return { userId: "", memberId: "" };
    const users = data.users ?? [];
    const matchingUsers = users.filter((user) => String(user.email ?? "").trim().toLowerCase() === normalizedEmail);
    const match =
      matchingUsers.find((user) => {
        const appRole = String((user.app_metadata?.role as string | undefined) ?? "").trim().toLowerCase();
        const userRole = String((user.user_metadata?.role as string | undefined) ?? "").trim().toLowerCase();
        return appRole === "member" || userRole === "member";
      }) ?? matchingUsers[0];
    if (match?.id) {
      const userId = String(match.id).trim();
      const memberId = String(
        (match.app_metadata?.member_id as string | undefined) ??
          (match.user_metadata?.member_id as string | undefined) ??
          "",
      ).trim();
      return { userId, memberId };
    }
    if (users.length < 200) break;
    page += 1;
  }
  return { userId: "", memberId: "" };
}

async function resolveAuthUserByMemberId(
  adminClient: ReturnType<typeof createClient>,
  memberId: string,
): Promise<{ userId: string; memberId: string }> {
  const normalizedMemberId = memberId.trim();
  if (!normalizedMemberId) return { userId: "", memberId: "" };
  let page = 1;
  for (let i = 0; i < 10; i += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) return { userId: "", memberId: "" };
    const users = data.users ?? [];
    const matchingUsers = users.filter((user) => {
      const appMemberId = String((user.app_metadata?.member_id as string | undefined) ?? "").trim();
      const userMemberId = String((user.user_metadata?.member_id as string | undefined) ?? "").trim();
      return appMemberId === normalizedMemberId || userMemberId === normalizedMemberId;
    });
    const match =
      matchingUsers.find((user) => {
        const appRole = String((user.app_metadata?.role as string | undefined) ?? "").trim().toLowerCase();
        const userRole = String((user.user_metadata?.role as string | undefined) ?? "").trim().toLowerCase();
        return appRole === "member" || userRole === "member";
      }) ?? matchingUsers[0];
    if (match?.id) {
      const userId = String(match.id).trim();
      const resolvedMemberId = String(
        (match.app_metadata?.member_id as string | undefined) ??
          (match.user_metadata?.member_id as string | undefined) ??
          "",
      ).trim();
      return { userId, memberId: resolvedMemberId };
    }
    if (users.length < 200) break;
    page += 1;
  }
  return { userId: "", memberId: "" };
}

async function ensureAuthMemberLink(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  memberId: string,
): Promise<void> {
  const resolvedUserId = userId.trim();
  const resolvedMemberId = memberId.trim();
  if (!resolvedUserId || !resolvedMemberId) return;
  const { data: userResult, error: getUserError } = await adminClient.auth.admin.getUserById(resolvedUserId);
  if (getUserError || !userResult?.user) return;
  const currentAppMeta = (userResult.user.app_metadata ?? {}) as Record<string, unknown>;
  const currentUserMeta = (userResult.user.user_metadata ?? {}) as Record<string, unknown>;
  const appMemberId = String(currentAppMeta.member_id ?? "").trim();
  const userMemberId = String(currentUserMeta.member_id ?? "").trim();
  if (appMemberId === resolvedMemberId && userMemberId === resolvedMemberId) return;
  await adminClient.auth.admin.updateUserById(resolvedUserId, {
    app_metadata: { ...currentAppMeta, member_id: resolvedMemberId },
    user_metadata: { ...currentUserMeta, member_id: resolvedMemberId },
  });
}

async function deterministicUuidFromSeed(seed: string): Promise<string> {
  const bytes = new TextEncoder().encode(seed);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest).slice(0, 16));
  // RFC4122 variant/version bits.
  hash[6] = (hash[6] & 0x0f) | 0x40;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return jsonResponse(200, { ok: false, inserted: 0, message: "Method not allowed" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(200, { ok: false, inserted: 0, message: "Missing Supabase environment variables" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";

    let payload: SendPayload;
    try {
      payload = (await req.json()) as SendPayload;
    } catch {
      return jsonResponse(200, { ok: false, inserted: 0, message: "Invalid JSON body" });
    }

    const memberId = String(payload.memberId ?? "").trim();
    const text = String(payload.text ?? "").trim();
    const sender = payload.sender === "member" ? "member" : "trainer";
    const payloadEmail = String(payload.targetEmail ?? "").trim().toLowerCase();
    const clientMessageId = String(payload.clientMessageId ?? "").trim();
    if (!memberId) return jsonResponse(200, { ok: false, inserted: 0, message: "memberId is required" });
    if (!text) return jsonResponse(200, { ok: false, inserted: 0, message: "text is required" });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    let authenticatedUserId = "";
    if (token) {
      const { data: userData, error: userError } = await adminClient.auth.getUser(token);
      if (!userError) {
        authenticatedUserId = String(userData?.user?.id ?? "").trim();
      }
    }

    const { data: memberRow, error: memberError } = await adminClient
      .from("members")
      .select("id, owner_user_id, email")
      .eq("id", memberId)
      .maybeSingle();
    if (memberError || !memberRow) {
      return jsonResponse(200, { ok: false, inserted: 0, message: "Member not found" });
    }
    const recipientAuthByMemberId = await resolveAuthUserByMemberId(adminClient, memberId);
    const anchorEmail = String((memberRow as { email?: string } | null)?.email ?? "").trim().toLowerCase() || payloadEmail;
    const recipientAuthByEmail = await resolveAuthUserByEmail(adminClient, anchorEmail);
    const recipientAuthUserId = recipientAuthByMemberId.userId || recipientAuthByEmail.userId;
    const recipientAuthMemberId = recipientAuthByMemberId.memberId || recipientAuthByEmail.memberId;
    let canonicalMemberId = recipientAuthMemberId || memberId;
    let canonicalMemberOwnerUserId = "";
    let canonicalEmail = anchorEmail;
    const canonicalMemberRow =
      canonicalMemberId && canonicalMemberId !== memberId
        ? await adminClient
            .from("members")
            .select("id, owner_user_id, email")
            .eq("id", canonicalMemberId)
            .maybeSingle()
        : { data: memberRow as Record<string, unknown>, error: null };
    if (canonicalMemberRow.data) {
      canonicalMemberOwnerUserId = String(
        (canonicalMemberRow.data as { owner_user_id?: string }).owner_user_id ??
          (memberRow as { owner_user_id?: string } | null)?.owner_user_id ??
          "",
      ).trim();
      canonicalEmail =
        String((canonicalMemberRow.data as { email?: string }).email ?? "").trim().toLowerCase() || canonicalEmail;
    }
    if (!recipientAuthMemberId && anchorEmail && anchorEmail.includes("@")) {
      const { data: siblingRows } = await adminClient
        .from("members")
        .select("id, email, owner_user_id, is_active, created_at")
        .ilike("email", anchorEmail);
      const siblings = (siblingRows ?? [])
        .map((row) => ({
          id: String((row as { id?: string }).id ?? "").trim(),
          email: String((row as { email?: string }).email ?? "").trim().toLowerCase(),
          ownerUserId: String((row as { owner_user_id?: string }).owner_user_id ?? "").trim(),
          isActive: (row as { is_active?: boolean | null }).is_active !== false,
          createdAtMs: new Date(String((row as { created_at?: string }).created_at ?? "")).getTime() || 0,
        }))
        .filter((row) => Boolean(row.id));
      if (siblings.length) {
        const sorted = [...siblings].sort((a, b) => {
          const activeDelta = Number(b.isActive) - Number(a.isActive);
          if (activeDelta !== 0) return activeDelta;
          if (b.createdAtMs !== a.createdAtMs) return b.createdAtMs - a.createdAtMs;
          return a.id.localeCompare(b.id);
        });
        const chosen = sorted[0];
        canonicalMemberId = chosen.id;
        canonicalMemberOwnerUserId = chosen.ownerUserId || canonicalMemberOwnerUserId;
        canonicalEmail = chosen.email || canonicalEmail;
      }
    }
    if (sender === "trainer" && recipientAuthUserId) {
      // Always align recipient auth link with canonical member row.
      await ensureAuthMemberLink(adminClient, recipientAuthUserId, canonicalMemberId);
    }
    const recipientOwnerUserId = canonicalMemberOwnerUserId;
    const nowIso = new Date().toISOString();
    const rows: Array<{
      id: string;
      member_id: string;
      owner_user_id: string;
      sender: "trainer" | "member";
      text: string;
      created_at: string;
    }> = [];
    const hintedOwner = "";
    const trainerResolvedRecipientUserId = recipientAuthUserId;
    if (sender === "trainer" && trainerResolvedRecipientUserId) {
      // Best effort link repair. Do not block message persistence if this fails.
      await ensureAuthMemberLink(adminClient, trainerResolvedRecipientUserId, canonicalMemberId);
    }
    const chosenOwnerUserId =
      sender === "trainer"
        ? trainerResolvedRecipientUserId || recipientOwnerUserId || authenticatedUserId
        : recipientAuthUserId || recipientOwnerUserId || hintedOwner || authenticatedUserId;
    if (!chosenOwnerUserId) {
      return jsonResponse(200, {
        ok: false,
        inserted: 0,
        message: "No owner resolved for message",
        debug: {
          inputMemberId: memberId,
          canonicalMemberId,
          anchorEmail: canonicalEmail,
          recipientAuthUserId,
          recipientAuthMemberId,
          chosenOwnerUserId: "",
        },
      });
    }
    const dedupeThresholdIso = new Date(Date.now() - 60000).toISOString();
    const dedupeBucket = Math.floor(Date.now() / 60000);
    const { data: recentMatchRows } = await adminClient
      .from("chat_messages")
      .select("id")
      .eq("member_id", canonicalMemberId)
      .eq("owner_user_id", chosenOwnerUserId)
      .eq("sender", sender)
      .eq("text", text)
      .gte("created_at", dedupeThresholdIso)
      .order("created_at", { ascending: false })
      .limit(1);
    const recentMatchId = String((recentMatchRows?.[0] as { id?: string } | undefined)?.id ?? "").trim();
    if (recentMatchId) {
      return jsonResponse(200, {
        ok: true,
        inserted: 0,
        messageId: recentMatchId,
      });
    }
    const deterministicId = clientMessageId
      ? await deterministicUuidFromSeed(`${canonicalMemberId}|${sender}|${clientMessageId}`)
      : await deterministicUuidFromSeed(`${canonicalMemberId}|${chosenOwnerUserId}|${sender}|${text}|${dedupeBucket}`);
    rows.push({
      id: deterministicId,
      member_id: canonicalMemberId,
      owner_user_id: chosenOwnerUserId,
      sender,
      text,
      created_at: nowIso,
    });
    const validRows = rows.filter((row) => row.member_id && row.owner_user_id);
    if (!validRows.length) {
      return jsonResponse(200, { ok: false, inserted: 0, message: "No target members resolved for message" });
    }
    const { data: insertedRows, error: insertError } = await adminClient
      .from("chat_messages")
      .upsert(validRows, { onConflict: "id", ignoreDuplicates: true })
      .select("id, member_id");
    if (insertError) {
      return jsonResponse(200, { ok: false, inserted: 0, message: insertError.message });
    }
    const firstMessageId = String((insertedRows?.[0] as { id?: string } | undefined)?.id ?? "");
    return jsonResponse(200, {
      ok: true,
      inserted: insertedRows?.length ?? 0,
      messageId: firstMessageId,
      debug: {
        inputMemberId: memberId,
        canonicalMemberId,
        anchorEmail: canonicalEmail,
        recipientAuthUserId,
        recipientAuthMemberId,
        chosenOwnerUserId,
      },
    });
  } catch (error) {
    return jsonResponse(200, {
      ok: false,
      inserted: 0,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});


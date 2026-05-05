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
};

async function resolveAuthUserIdByEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string,
): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) return "";
  let page = 1;
  for (let i = 0; i < 10; i += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) return "";
    const users = data.users ?? [];
    const match = users.find((user) => String(user.email ?? "").trim().toLowerCase() === normalizedEmail);
    if (match?.id) return String(match.id).trim();
    if (users.length < 200) break;
    page += 1;
  }
  return "";
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
    const payloadName = String(payload.targetName ?? "").trim().toLowerCase();
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
      .select("id, owner_user_id, email, name")
      .eq("id", memberId)
      .maybeSingle();
    const anchorEmail = String((memberRow as { email?: string } | null)?.email ?? "").trim().toLowerCase() || payloadEmail;
    const anchorName = String((memberRow as { name?: string } | null)?.name ?? "").trim().toLowerCase() || payloadName;
    if ((memberError || !memberRow) && !anchorEmail && !anchorName) {
      return jsonResponse(200, { ok: false, inserted: 0, message: "Member not found" });
    }
    const targetById = new Map<string, { id: string; owner_user_id: string; email: string }>();

    const addTargets = (rows: Array<Record<string, unknown>> | null | undefined) => {
      (rows ?? []).forEach((row) => {
        const id = String(row.id ?? "").trim();
        if (!id) return;
        targetById.set(id, {
          id,
          owner_user_id: String(row.owner_user_id ?? "").trim(),
          email: String(row.email ?? "").trim().toLowerCase(),
        });
      });
    };

    if (memberRow) {
      const selfRow = memberRow as Record<string, unknown>;
      addTargets([selfRow]);
    }

    if (anchorEmail) {
      const { data: relatedByEmail, error: relatedByEmailError } = await adminClient
        .from("members")
        .select("id, owner_user_id, email")
        .ilike("email", anchorEmail);
      if (relatedByEmailError) {
        return jsonResponse(200, { ok: false, inserted: 0, message: relatedByEmailError.message });
      }
      addTargets((relatedByEmail ?? []) as Array<Record<string, unknown>>);
    }

    if (anchorName) {
      const { data: relatedByName, error: relatedByNameError } = await adminClient
        .from("members")
        .select("id, owner_user_id, email")
        .ilike("name", anchorName);
      if (relatedByNameError) {
        return jsonResponse(200, { ok: false, inserted: 0, message: relatedByNameError.message });
      }
      addTargets((relatedByName ?? []) as Array<Record<string, unknown>>);
    }

    const targets = Array.from(targetById.values());

    // Heal legacy rows with missing owner_user_id:
    // 1) Prefer owner from sibling rows with same email.
    // 2) Only fall back to authenticated sender when sender is trainer.
    const missingOwnerTargets = targets.filter((row) => !row.owner_user_id);
    if (missingOwnerTargets.length > 0) {
      for (const target of missingOwnerTargets) {
        const targetEmail = String(target.email ?? "").trim().toLowerCase();
        let resolvedOwner = "";
        if (targetEmail) {
          const { data: ownerCandidates } = await adminClient
            .from("members")
            .select("owner_user_id")
            .ilike("email", targetEmail)
            .not("owner_user_id", "is", null)
            .limit(1);
          resolvedOwner = String((ownerCandidates?.[0] as { owner_user_id?: string } | undefined)?.owner_user_id ?? "").trim();
        }
        if (!resolvedOwner && sender === "trainer" && authenticatedUserId) {
          resolvedOwner = authenticatedUserId;
        }
        if (!resolvedOwner) continue;
        const { data: healedRows } = await adminClient
          .from("members")
          .update({ owner_user_id: resolvedOwner })
          .eq("id", target.id)
          .select("id, owner_user_id, email");
        addTargets((healedRows ?? []) as Array<Record<string, unknown>>);
      }
    }

    const finalTargets = Array.from(targetById.values());
    const targetMemberIds = finalTargets.map((row) => row.id).filter(Boolean);
    const ownerHints = new Set<string>();
    if (targetMemberIds.length > 0) {
      const { data: programOwnerRows } = await adminClient
        .from("training_programs")
        .select("owner_user_id")
        .in("member_id", targetMemberIds)
        .not("owner_user_id", "is", null);
      (programOwnerRows ?? []).forEach((row) => {
        const ownerUserId = String((row as { owner_user_id?: string }).owner_user_id ?? "").trim();
        if (ownerUserId) ownerHints.add(ownerUserId);
      });
      const { data: logOwnerRows } = await adminClient
        .from("workout_logs")
        .select("owner_user_id")
        .in("member_id", targetMemberIds)
        .not("owner_user_id", "is", null);
      (logOwnerRows ?? []).forEach((row) => {
        const ownerUserId = String((row as { owner_user_id?: string }).owner_user_id ?? "").trim();
        if (ownerUserId) ownerHints.add(ownerUserId);
      });
      const { data: messageOwnerRows } = await adminClient
        .from("chat_messages")
        .select("owner_user_id")
        .in("member_id", targetMemberIds)
        .not("owner_user_id", "is", null)
        .limit(100);
      (messageOwnerRows ?? []).forEach((row) => {
        const ownerUserId = String((row as { owner_user_id?: string }).owner_user_id ?? "").trim();
        if (ownerUserId) ownerHints.add(ownerUserId);
      });
    }
    const nowIso = new Date().toISOString();
    const rows: Array<{
      member_id: string;
      owner_user_id: string;
      sender: "trainer" | "member";
      text: string;
      created_at: string;
    }> = [];
    const canonicalMemberId =
      finalTargets.find((row) => row.id === memberId)?.id ??
      finalTargets[0]?.id ??
      memberId;
    const primaryTarget = finalTargets.find((row) => row.id === canonicalMemberId) ?? finalTargets[0] ?? null;
    const recipientOwnerUserId = String(primaryTarget?.owner_user_id ?? "").trim();
    const recipientAuthUserId = await resolveAuthUserIdByEmail(adminClient, String(primaryTarget?.email ?? ""));
    const hintedOwner = Array.from(ownerHints)[0] ?? "";
    const chosenOwnerUserId =
      recipientOwnerUserId ||
      hintedOwner ||
      authenticatedUserId ||
      recipientAuthUserId;
    if (chosenOwnerUserId) {
      rows.push({
        member_id: canonicalMemberId,
        owner_user_id: chosenOwnerUserId,
        sender,
        text,
        created_at: nowIso,
      });
    }
    const validRows = rows.filter((row) => row.member_id && row.owner_user_id);
    if (!validRows.length) {
      return jsonResponse(200, { ok: false, inserted: 0, message: "No target members resolved for message" });
    }
    const { data: insertedRows, error: insertError } = await adminClient
      .from("chat_messages")
      .insert(validRows)
      .select("id, member_id");
    if (insertError) {
      return jsonResponse(200, { ok: false, inserted: 0, message: insertError.message });
    }
    const firstMessageId = String((insertedRows?.[0] as { id?: string } | undefined)?.id ?? "");
    return jsonResponse(200, {
      ok: true,
      inserted: insertedRows?.length ?? 0,
      messageId: firstMessageId,
    });
  } catch (error) {
    return jsonResponse(200, {
      ok: false,
      inserted: 0,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});


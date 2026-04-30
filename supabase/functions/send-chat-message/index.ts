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
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing Supabase environment variables" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return jsonResponse(401, { error: "Missing bearer token" });

  let payload: SendPayload;
  try {
    payload = (await req.json()) as SendPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const memberId = String(payload.memberId ?? "").trim();
  const text = String(payload.text ?? "").trim();
  const sender = payload.sender === "member" ? "member" : "trainer";
  if (!memberId) return jsonResponse(400, { error: "memberId is required" });
  if (!text) return jsonResponse(400, { error: "text is required" });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  const authenticatedUserId = String(userData?.user?.id ?? "").trim();
  if (userError || !authenticatedUserId) {
    return jsonResponse(401, { error: "Invalid user session" });
  }

  const { data: memberRow, error: memberError } = await adminClient
    .from("members")
    .select("id, owner_user_id, email, name")
    .eq("id", memberId)
    .maybeSingle();
  if (memberError || !memberRow) {
    return jsonResponse(404, { error: "Member not found" });
  }
  const anchorEmail = String((memberRow as { email?: string }).email ?? "").trim().toLowerCase();
  const anchorName = String((memberRow as { name?: string }).name ?? "").trim().toLowerCase();
  const targetById = new Map<string, { id: string; owner_user_id: string }>();

  const addTargets = (rows: Array<Record<string, unknown>> | null | undefined) => {
    (rows ?? []).forEach((row) => {
      const id = String(row.id ?? "").trim();
      if (!id) return;
      targetById.set(id, {
        id,
        owner_user_id: String(row.owner_user_id ?? "").trim(),
      });
    });
  };

  const selfRow = memberRow as Record<string, unknown>;
  addTargets([selfRow]);

  if (anchorEmail) {
    const { data: relatedByEmail, error: relatedByEmailError } = await adminClient
      .from("members")
      .select("id, owner_user_id")
      .eq("email", anchorEmail);
    if (relatedByEmailError) {
      return jsonResponse(500, { error: relatedByEmailError.message });
    }
    addTargets((relatedByEmail ?? []) as Array<Record<string, unknown>>);
  }

  if (anchorName) {
    const { data: relatedByName, error: relatedByNameError } = await adminClient
      .from("members")
      .select("id, owner_user_id")
      .eq("name", anchorName);
    if (relatedByNameError) {
      return jsonResponse(500, { error: relatedByNameError.message });
    }
    addTargets((relatedByName ?? []) as Array<Record<string, unknown>>);
  }

  const targets = Array.from(targetById.values());
  const nowIso = new Date().toISOString();
  const rows: Array<{
    member_id: string;
    owner_user_id: string;
    sender: "trainer" | "member";
    text: string;
    created_at: string;
  }> = [];
  targets.forEach((row) => {
    const memberIdForRow = row.id;
    const recipientOwnerUserId = (row.owner_user_id ?? "").trim();
    const ownerCandidates = Array.from(new Set([authenticatedUserId, recipientOwnerUserId].filter(Boolean)));
    if (ownerCandidates.length === 0) {
      ownerCandidates.push(authenticatedUserId);
    }
    ownerCandidates.forEach((ownerUserId) => {
      rows.push({
        member_id: memberIdForRow,
        owner_user_id: ownerUserId,
        sender,
        text,
        created_at: nowIso,
      });
    });
  });
  const validRows = rows.filter((row) => row.member_id && row.owner_user_id);
  if (!validRows.length) {
    return jsonResponse(400, { error: "No target members resolved for message" });
  }
  const { data: insertedRows, error: insertError } = await adminClient
    .from("chat_messages")
    .insert(validRows)
    .select("id, member_id");
  if (insertError) {
    return jsonResponse(500, { error: insertError.message });
  }
  const firstMessageId = String((insertedRows?.[0] as { id?: string } | undefined)?.id ?? "");
  return jsonResponse(200, {
    ok: true,
    inserted: insertedRows?.length ?? 0,
    messageId: firstMessageId,
  });
});


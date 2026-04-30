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
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: "Invalid user session" });
  }

  const authRole = (() => {
    const appRole = userData.user.app_metadata?.role;
    if (appRole === "member" || appRole === "trainer") return appRole;
    const userRole = userData.user.user_metadata?.role;
    if (userRole === "member" || userRole === "trainer") return userRole;
    return "";
  })();
  if (authRole === "member" && sender !== "member") {
    return jsonResponse(403, { error: "Members can only send member messages" });
  }
  if (authRole === "trainer" && sender !== "trainer") {
    return jsonResponse(403, { error: "Trainers can only send trainer messages" });
  }

  const { data: memberRow, error: memberError } = await adminClient
    .from("members")
    .select("id, owner_user_id, email")
    .eq("id", memberId)
    .maybeSingle();
  if (memberError || !memberRow) {
    return jsonResponse(404, { error: "Member not found" });
  }
  const anchorEmail = String((memberRow as { email?: string }).email ?? "").trim().toLowerCase();
  const { data: relatedMembers, error: relatedMembersError } = anchorEmail
    ? await adminClient
        .from("members")
        .select("id, owner_user_id, email")
        .eq("email", anchorEmail)
    : await adminClient.from("members").select("id, owner_user_id, email").eq("id", memberId);
  if (relatedMembersError) {
    return jsonResponse(500, { error: relatedMembersError.message });
  }
  const targets = (relatedMembers ?? []).length ? relatedMembers : [memberRow];
  const nowIso = new Date().toISOString();
  const rows = targets.map((row) => {
    const typed = row as { id?: string; owner_user_id?: string };
    return {
      member_id: String(typed.id ?? "").trim(),
      owner_user_id: String(typed.owner_user_id ?? "").trim() || userData.user.id,
      sender,
      text,
      created_at: nowIso,
    };
  });
  const validRows = rows.filter((row) => row.member_id);
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


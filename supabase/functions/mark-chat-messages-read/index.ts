import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type MarkReadPayload = {
  memberId?: string;
  reader?: "trainer" | "member";
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

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse(401, { error: "Missing bearer token" });

  let payload: MarkReadPayload;
  try {
    payload = (await req.json()) as MarkReadPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const memberId = String(payload.memberId ?? "").trim();
  const reader = payload.reader;
  if (!memberId || (reader !== "trainer" && reader !== "member")) {
    return jsonResponse(400, { error: "memberId and reader (trainer|member) are required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData.user) return jsonResponse(401, { error: "Invalid session" });

  const now = new Date().toISOString();
  const column = reader === "trainer" ? "read_by_trainer_at" : "read_by_member_at";
  const senderFilter = reader === "trainer" ? "member" : "trainer";

  const { data, error } = await adminClient
    .from("chat_messages")
    .update({ [column]: now })
    .eq("member_id", memberId)
    .eq("sender", senderFilter)
    .is(column, null)
    .select("id");

  if (error) {
    if (error.message.includes("read_by_")) {
      return jsonResponse(503, { error: "Read receipts not migrated. Run chat_message_read_receipts.sql." });
    }
    return jsonResponse(500, { error: error.message });
  }

  return jsonResponse(200, { ok: true, updated: (data ?? []).length, readAt: now });
});

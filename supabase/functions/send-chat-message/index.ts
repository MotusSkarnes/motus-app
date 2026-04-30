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
    .select("id, owner_user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (memberError || !memberRow) {
    return jsonResponse(404, { error: "Member not found" });
  }

  const ownerUserId = String((memberRow as { owner_user_id?: string }).owner_user_id ?? "").trim() || userData.user.id;
  const { data: inserted, error: insertError } = await adminClient
    .from("chat_messages")
    .insert({
      member_id: memberId,
      owner_user_id: ownerUserId,
      sender,
      text,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (insertError) {
    return jsonResponse(500, { error: insertError.message });
  }

  return jsonResponse(200, {
    ok: true,
    messageId: String((inserted as { id?: string } | null)?.id ?? ""),
  });
});


import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DeletePayload = {
  memberId?: string;
  email?: string;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

  let payload: DeletePayload;
  try {
    payload = (await req.json()) as DeletePayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const memberId = payload.memberId?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  if (!memberId && !email) {
    return jsonResponse(400, { error: "memberId or email is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  if (memberId) {
    await adminClient.from("members").update({ is_active: false }).eq("id", memberId);
    await adminClient.from("chat_messages").delete().eq("member_id", memberId);
    await adminClient.from("workout_logs").delete().eq("member_id", memberId);
    await adminClient.from("training_programs").delete().eq("member_id", memberId);
    await adminClient.from("members").delete().eq("id", memberId);
  }

  if (email) {
    await adminClient.from("members").update({ is_active: false }).ilike("email", email);
    const { data: membersByEmail } = await adminClient.from("members").select("id").ilike("email", email);
    const ids = (membersByEmail ?? []).map((row) => String((row as { id: string }).id));
    for (const id of ids) {
      await adminClient.from("chat_messages").delete().eq("member_id", id);
      await adminClient.from("workout_logs").delete().eq("member_id", id);
      await adminClient.from("training_programs").delete().eq("member_id", id);
    }
    await adminClient.from("members").delete().ilike("email", email);
  }

  return jsonResponse(200, { message: "Member deletion completed" });
});


import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type HydratePayload = {
  ownerUserId?: string;
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

  let payload: HydratePayload;
  try {
    payload = (await req.json()) as HydratePayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const ownerUserId = String(payload.ownerUserId ?? "").trim();
  if (!ownerUserId) {
    return jsonResponse(400, { error: "ownerUserId is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Recovery: claim legacy rows with missing owner_user_id.
  await adminClient.from("members").update({ owner_user_id: ownerUserId }).is("owner_user_id", null);

  const { data: ownedMembers } = await adminClient.from("members").select("id").eq("owner_user_id", ownerUserId);
  const ownedMemberIds = (ownedMembers ?? []).map((row) => String((row as { id?: string }).id ?? "")).filter(Boolean);

  if (ownedMemberIds.length > 0) {
    await adminClient
      .from("training_programs")
      .update({ owner_user_id: ownerUserId })
      .is("owner_user_id", null)
      .in("member_id", ownedMemberIds);
    await adminClient
      .from("workout_logs")
      .update({ owner_user_id: ownerUserId })
      .is("owner_user_id", null)
      .in("member_id", ownedMemberIds);
    await adminClient
      .from("chat_messages")
      .update({ owner_user_id: ownerUserId })
      .is("owner_user_id", null)
      .in("member_id", ownedMemberIds);
  }

  const { data: members, error: membersError } = await adminClient
    .from("members")
    .select("id, name, email, is_active, invited_at, phone, birth_date, weight, height, level, membership_type, customer_type, days_since_activity, goal, focus, personal_goals, injuries, coach_notes, created_at")
    .eq("owner_user_id", ownerUserId)
    .or("is_active.is.null,is_active.eq.true")
    .order("created_at", { ascending: true });

  const { data: programs, error: programsError } = await adminClient
    .from("training_programs")
    .select("id, member_id, title, goal, notes, exercises, created_at")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });

  const { data: logs, error: logsError } = await adminClient
    .from("workout_logs")
    .select("id, member_id, program_title, date, status, note, results, created_at")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });

  const { data: messages, error: messagesError } = await adminClient
    .from("chat_messages")
    .select("id, member_id, sender, text, created_at")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: true });

  const { data: exercises, error: exercisesError } = await adminClient
    .from("exercise_bank")
    .select("id, name, category, muscle_group, equipment, level, description, image_url")
    .order("name", { ascending: true });

  const firstError = membersError ?? programsError ?? logsError ?? messagesError ?? exercisesError;
  if (firstError) {
    return jsonResponse(500, { error: firstError.message });
  }

  return jsonResponse(200, {
    members: members ?? [],
    programs: programs ?? [],
    logs: logs ?? [],
    messages: messages ?? [],
    exercises: exercises ?? [],
  });
});

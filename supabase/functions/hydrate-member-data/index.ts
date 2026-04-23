import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) {
    return jsonResponse(401, { error: "Missing bearer token" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: "Invalid session token" });
  }

  const requesterEmail = normalizeEmail(userData.user.email);
  if (!requesterEmail || !requesterEmail.includes("@")) {
    return jsonResponse(400, { error: "Authenticated user email is missing" });
  }

  const { data: members, error: membersError } = await adminClient
    .from("members")
    .select("id, name, email, is_active, invited_at, phone, birth_date, weight, height, level, membership_type, customer_type, days_since_activity, goal, focus, personal_goals, injuries, coach_notes, created_at")
    .eq("email", requesterEmail)
    .order("created_at", { ascending: false });
  if (membersError) {
    return jsonResponse(500, { error: membersError.message });
  }

  const memberIds = (members ?? [])
    .map((row) => String((row as { id?: string }).id ?? "").trim())
    .filter(Boolean);
  if (!memberIds.length) {
    return jsonResponse(200, {
      members: [],
      programs: [],
      logs: [],
      messages: [],
    });
  }

  const { data: programs, error: programsError } = await adminClient
    .from("training_programs")
    .select("id, member_id, title, goal, notes, exercises, created_at")
    .in("member_id", memberIds)
    .order("created_at", { ascending: false });
  const { data: logs, error: logsError } = await adminClient
    .from("workout_logs")
    .select("id, member_id, program_title, date, status, note, results, created_at")
    .in("member_id", memberIds)
    .order("created_at", { ascending: false });
  const { data: messages, error: messagesError } = await adminClient
    .from("chat_messages")
    .select("id, member_id, sender, text, created_at")
    .in("member_id", memberIds)
    .order("created_at", { ascending: true });

  const firstError = programsError ?? logsError ?? messagesError;
  if (firstError) {
    return jsonResponse(500, { error: firstError.message });
  }

  return jsonResponse(200, {
    members: members ?? [],
    programs: programs ?? [],
    logs: logs ?? [],
    messages: messages ?? [],
  });
});

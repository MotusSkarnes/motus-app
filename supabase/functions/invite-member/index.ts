import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type InvitePayload = {
  email?: string;
  memberId?: string;
  accessToken?: string;
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
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing Supabase environment variables" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let payload: InvitePayload;
  try {
    payload = (await req.json()) as InvitePayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : "";
  const token = payload.accessToken?.trim() || bearerToken;
  if (!token) {
    return jsonResponse(401, { error: "Missing access token" });
  }

  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  const user = userData.user;

  if (userError || !user) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const callerRole = user.app_metadata?.role;
  if (callerRole !== "trainer") {
    return jsonResponse(403, { error: "Only trainers can send invites" });
  }

  const email = payload.email?.trim().toLowerCase();
  const memberId = payload.memberId?.trim();

  if (!email || !email.includes("@")) {
    return jsonResponse(400, { error: "Valid email is required" });
  }
  if (!memberId) {
    return jsonResponse(400, { error: "memberId is required" });
  }

  const { data: memberData, error: memberError } = await adminClient
    .from("members")
    .select("id, name, email")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) {
    return jsonResponse(500, { error: memberError.message });
  }

  if (!memberData) {
    return jsonResponse(404, { error: "Member not found" });
  }

  const memberEmail = String(memberData.email ?? "").trim().toLowerCase();
  if (memberEmail !== email) {
    return jsonResponse(400, {
      error: "Email must match selected member email",
    });
  }

  const inviteResult = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      member_id: memberId,
      role: "member",
      name: String(memberData.name ?? ""),
    },
  });

  if (inviteResult.error) {
    return jsonResponse(500, { error: inviteResult.error.message });
  }

  const invitedUserId = inviteResult.data.user?.id;
  if (invitedUserId) {
    const { error: updateError } = await adminClient.auth.admin.updateUserById(invitedUserId, {
      app_metadata: {
        role: "member",
        member_id: memberId,
      },
    });
    if (updateError) {
      return jsonResponse(500, {
        error: `Invite sent, but metadata update failed: ${updateError.message}`,
      });
    }
  }

  const { error: memberUpdateError } = await adminClient
    .from("members")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", memberId);
  if (memberUpdateError) {
    return jsonResponse(500, {
      error: `Invite sent, but member invite status update failed: ${memberUpdateError.message}`,
    });
  }

  return jsonResponse(200, {
    message: `Invitasjon sendt til ${email}`,
    invited_user_id: invitedUserId ?? null,
  });
});

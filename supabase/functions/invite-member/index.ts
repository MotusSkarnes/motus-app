import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type InvitePayload = {
  email?: string;
  memberId?: string;
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
    return jsonResponse(500, {
      error: "Missing Supabase environment variables (expected SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY)",
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let payload: InvitePayload;
  try {
    payload = (await req.json()) as InvitePayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const email = payload.email?.trim().toLowerCase();
  const memberId = payload.memberId?.trim();

  if (!email || !email.includes("@")) {
    return jsonResponse(400, { error: "Valid email is required" });
  }
  if (!memberId) {
    return jsonResponse(400, { error: "memberId is required" });
  }

  const { data: memberDataById, error: memberErrorById } = await adminClient
    .from("members")
    .select("id, name, email")
    .eq("id", memberId)
    .maybeSingle();

  if (memberErrorById) {
    return jsonResponse(500, { error: memberErrorById.message });
  }

  let resolvedMember = memberDataById;
  if (!resolvedMember) {
    const { data: memberDataByEmail, error: memberErrorByEmail } = await adminClient
      .from("members")
      .select("id, name, email")
      .eq("email", email)
      .maybeSingle();

    if (memberErrorByEmail) {
      return jsonResponse(500, { error: memberErrorByEmail.message });
    }

    if (memberDataByEmail) {
      resolvedMember = memberDataByEmail;
    } else {
      const fallbackName = email.split("@")[0] || "Nytt medlem";
      const { data: insertedMember, error: insertMemberError } = await adminClient
        .from("members")
        .insert({
          id: memberId,
          name: fallbackName,
          email,
          is_active: true,
          goal: "Nytt mål settes her",
          focus: "Ikke satt",
          phone: "",
          days_since_activity: "0",
        })
        .select("id, name, email")
        .single();

      if (insertMemberError || !insertedMember) {
        return jsonResponse(500, {
          error: `Could not create missing member row: ${insertMemberError?.message ?? "Unknown error"}`,
        });
      }
      resolvedMember = insertedMember;
    }
  }

  const memberEmail = String(resolvedMember.email ?? "").trim().toLowerCase();
  if (memberEmail !== email) {
    return jsonResponse(400, {
      error: "Email must match selected member email",
    });
  }

  const inviteResult = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      member_id: String(resolvedMember.id),
      role: "member",
      name: String(resolvedMember.name ?? ""),
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
        member_id: String(resolvedMember.id),
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
    .eq("id", String(resolvedMember.id));
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

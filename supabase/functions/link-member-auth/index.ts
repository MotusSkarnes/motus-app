import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LinkPayload = {
  email?: string;
  memberId?: string;
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

  let payload: LinkPayload;
  try {
    payload = (await req.json()) as LinkPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const email = normalizeEmail(payload.email);
  let memberId = String(payload.memberId ?? "").trim();
  if (!email || !email.includes("@")) {
    return jsonResponse(400, { error: "Valid email is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  if (!memberId) {
    const { data: memberRows, error: memberLookupError } = await adminClient
      .from("members")
      .select("id, is_active, created_at")
      .eq("email", email)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);
    if (memberLookupError) {
      return jsonResponse(500, { error: `Could not resolve member by email: ${memberLookupError.message}` });
    }
    memberId = String(memberRows?.[0]?.id ?? "").trim();
  }
  if (!memberId) {
    return jsonResponse(404, { error: "No member row found for email" });
  }

  const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    return jsonResponse(500, { error: `Could not list auth users: ${listError.message}` });
  }

  const users = listData?.users ?? [];
  const targetUsers = users.filter((user) => normalizeEmail(user.email) === email);
  if (!targetUsers.length) {
    return jsonResponse(200, { message: "No matching auth user found for email", updated: 0 });
  }

  let updated = 0;
  for (const user of targetUsers) {
    const existingAppMetadata =
      user.app_metadata && typeof user.app_metadata === "object"
        ? (user.app_metadata as Record<string, unknown>)
        : {};

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...existingAppMetadata,
        role: "member",
        member_id: memberId,
      },
    });
    if (!updateError) {
      updated += 1;
    }
  }

  return jsonResponse(200, { message: "Auth member link synced", updated });
});

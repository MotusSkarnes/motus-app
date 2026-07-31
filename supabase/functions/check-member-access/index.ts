import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MEMBER_ARCHIVED_MESSAGE =
  "Kundekontoen er arkivert. Kontakt din PT for å gjenåpne tilgang til appen.";

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function currentOsloDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isArchiveDue(row: { archive_scheduled_for?: string | null }): boolean {
  const date = String(row.archive_scheduled_for ?? "").trim();
  return Boolean(date && date <= currentOsloDate());
}

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

  let bodyEmail = "";
  try {
    const payload = (await req.json()) as { email?: string };
    bodyEmail = normalizeEmail(payload.email);
  } catch {
    bodyEmail = "";
  }

  const sessionEmail = normalizeEmail(userData.user.email);
  if (bodyEmail && bodyEmail !== sessionEmail) {
    return jsonResponse(403, { error: "Email does not match authenticated user" });
  }

  const requesterEmail = sessionEmail;
  if (!requesterEmail.includes("@")) {
    return jsonResponse(400, { error: "Valid email is required" });
  }

  let { data: rows, error: fetchError } = await adminClient
    .from("members")
    .select("id, email, is_active, archive_scheduled_for")
    .ilike("email", requesterEmail);

  if (fetchError && fetchError.message.includes("archive_scheduled_for")) {
    const fallback = await adminClient
      .from("members")
      .select("id, email, is_active")
      .ilike("email", requesterEmail);
    rows = fallback.data;
    fetchError = fallback.error;
  }

  if (fetchError) {
    return jsonResponse(500, { error: fetchError.message });
  }

  const matchingRows = (rows ?? []).filter((row) => normalizeEmail((row as { email?: string }).email) === requesterEmail);

  const memberIdFromJwt = String(
    userData.user.app_metadata?.member_id ?? userData.user.user_metadata?.member_id ?? "",
  ).trim();
  const rosterRows: Array<{ id?: string; email?: string; is_active?: boolean | null; archive_scheduled_for?: string | null }> = [...matchingRows];
  if (memberIdFromJwt) {
    let { data: byIdRow, error: byIdError } = await adminClient
      .from("members")
      .select("id, email, is_active, archive_scheduled_for")
      .eq("id", memberIdFromJwt)
      .maybeSingle();
    if (byIdError && byIdError.message.includes("archive_scheduled_for")) {
      const fallback = await adminClient.from("members").select("id, email, is_active").eq("id", memberIdFromJwt).maybeSingle();
      byIdRow = fallback.data;
      byIdError = fallback.error;
    }
    if (byIdError) {
      return jsonResponse(500, { error: byIdError.message });
    }
    if (byIdRow && !rosterRows.some((row) => String(row.id ?? "") === memberIdFromJwt)) {
      rosterRows.push(byIdRow as { id?: string; email?: string; is_active?: boolean | null; archive_scheduled_for?: string | null });
    }
  }

  const dueIds = rosterRows
    .filter((row) => row.is_active !== false && isArchiveDue(row))
    .map((row) => String(row.id ?? "").trim())
    .filter(Boolean);
  if (dueIds.length > 0) {
    const { error: archiveError } = await adminClient.from("members").update({ is_active: false }).in("id", dueIds);
    if (!archiveError) {
      rosterRows.forEach((row) => {
        if (dueIds.includes(String(row.id ?? "").trim())) row.is_active = false;
      });
    }
  }

  if (rosterRows.length > 0 && !rosterRows.some((row) => row.is_active !== false)) {
    return jsonResponse(403, {
      status: "archived",
      error: "member_archived",
      message: MEMBER_ARCHIVED_MESSAGE,
    });
  }

  return jsonResponse(200, {
    status: rosterRows.some((row) => row.is_active !== false) ? "active" : "no_roster",
    rosterCount: rosterRows.length,
  });
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ArchivePayload = {
  email?: string;
  memberId?: string;
};

function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
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

  let payload: ArchivePayload;
  try {
    payload = (await req.json()) as ArchivePayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const email = normalizeEmail(payload.email);
  const memberId = String(payload.memberId ?? "").trim();

  if (!email && !memberId) {
    return jsonResponse(400, { error: "email or memberId is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let matchingRows: Array<{ id: string; email: string | null; is_active: boolean | null }> = [];

  if (email && email.includes("@")) {
    const { data: rows, error: fetchError } = await adminClient.from("members").select("id, email, is_active").ilike("email", email);
    if (fetchError) {
      return jsonResponse(500, { error: fetchError.message });
    }
    matchingRows = (rows ?? []).filter((row) => normalizeEmail(String(row.email ?? "")) === email) as typeof matchingRows;
  }

  if (memberId && !matchingRows.some((row) => row.id === memberId)) {
    const { data: row, error: rowError } = await adminClient
      .from("members")
      .select("id, email, is_active")
      .eq("id", memberId)
      .maybeSingle();
    if (rowError) {
      return jsonResponse(500, { error: rowError.message });
    }
    if (row) {
      matchingRows.push(row as { id: string; email: string | null; is_active: boolean | null });
    }
  }

  if (!matchingRows.length) {
    return jsonResponse(404, { error: "Ingen klient funnet med denne e-posten eller id" });
  }

  const ids = Array.from(new Set(matchingRows.map((row) => String(row.id)).filter(Boolean)));
  const { error } = await adminClient
    .from("members")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in("id", ids);

  if (error) {
    return jsonResponse(500, { error: error.message });
  }

  const archivedCount = matchingRows.filter((row) => row.is_active !== false).length;

  return jsonResponse(200, {
    message: "Member archived",
    archivedCount: ids.length,
    newlyArchivedCount: archivedCount,
  });
});

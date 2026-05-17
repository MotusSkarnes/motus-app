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

type AuthUser = {
  id?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type MemberRow = {
  id: string;
  email: string | null;
  is_active: boolean | null;
  owner_user_id: string | null;
  customer_type: string | null;
};

function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function isTrainerUser(user: AuthUser): boolean {
  const appRole = normalizeString(user.app_metadata?.role).toLowerCase();
  if (appRole === "trainer") return true;
  const metaRole = normalizeString(user.user_metadata?.role).toLowerCase();
  return metaRole === "trainer";
}

function isSharedMemberRow(row: MemberRow): boolean {
  return normalizeString(row.customer_type).toLowerCase() === "medlem";
}

function canManageMemberRow(row: MemberRow, user: AuthUser): boolean {
  const userId = normalizeString(user.id);
  const ownerUserId = normalizeString(row.owner_user_id);
  if (userId && ownerUserId === userId) return true;
  if (!isTrainerUser(user)) return false;
  return !ownerUserId || isSharedMemberRow(row);
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

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse(401, { error: "Missing bearer token" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);
  if (userError || !user?.id) {
    return jsonResponse(401, { error: "Invalid user session" });
  }

  let matchingRows: MemberRow[] = [];

  if (email && email.includes("@")) {
    const { data: rows, error: fetchError } = await adminClient
      .from("members")
      .select("id, email, is_active, owner_user_id, customer_type")
      .ilike("email", email);
    if (fetchError) {
      return jsonResponse(500, { error: fetchError.message });
    }
    matchingRows = (rows ?? []).filter((row) => normalizeEmail(String(row.email ?? "")) === email) as typeof matchingRows;
  }

  if (memberId && !matchingRows.some((row) => row.id === memberId)) {
    const { data: row, error: rowError } = await adminClient
      .from("members")
      .select("id, email, is_active, owner_user_id, customer_type")
      .eq("id", memberId)
      .maybeSingle();
    if (rowError) {
      return jsonResponse(500, { error: rowError.message });
    }
    if (row) {
      matchingRows.push(row as MemberRow);
    }
  }

  if (!matchingRows.length) {
    return jsonResponse(404, { error: "Ingen klient funnet med denne e-posten eller id" });
  }

  const unauthorizedRows = matchingRows.filter((row) => !canManageMemberRow(row, user));
  if (unauthorizedRows.length > 0) {
    return jsonResponse(403, { error: "Not authorized to archive this member" });
  }

  const ids = Array.from(new Set(matchingRows.map((row) => normalizeString(row.id)).filter(Boolean)));
  const { error } = await adminClient
    .from("members")
    .update({ is_active: false })
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

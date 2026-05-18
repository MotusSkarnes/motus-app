import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RestorePayload = {
  email?: string;
  ownerUserId?: string;
  lookupOnly?: boolean;
};

type MemberRow = {
  id?: string;
  email?: string | null;
  name?: string | null;
  is_active?: boolean | null;
  owner_user_id?: string | null;
  customer_type?: string | null;
};

function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function isSharedMedlem(customerType: string | null | undefined): boolean {
  return String(customerType ?? "").trim().toLowerCase() === "medlem";
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function listMembersByEmail(adminClient: ReturnType<typeof createClient>, email: string): Promise<MemberRow[]> {
  const { data: rows, error: fetchError } = await adminClient
    .from("members")
    .select("id, email, name, is_active, owner_user_id, customer_type")
    .ilike("email", email);
  if (fetchError) {
    throw new Error(fetchError.message);
  }
  return (rows ?? []).filter((row) => normalizeEmail(String((row as MemberRow).email ?? "")) === email) as MemberRow[];
}

async function recreateMemberFromAuth(
  adminClient: ReturnType<typeof createClient>,
  email: string,
  ownerUserId: string,
): Promise<MemberRow | null> {
  const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    throw new Error(`Kunne ikke slå opp Auth-bruker: ${listError.message}`);
  }
  const matchedUser = (listData?.users ?? []).find((user) => normalizeEmail(user.email) === email);
  if (!matchedUser) return null;

  const memberId =
    String(matchedUser.app_metadata?.member_id ?? "").trim() ||
    String(matchedUser.user_metadata?.member_id ?? "").trim() ||
    String(matchedUser.id ?? "").trim();
  if (!memberId) return null;

  const fallbackName =
    String(matchedUser.user_metadata?.full_name ?? matchedUser.user_metadata?.name ?? "").trim() ||
    email.split("@")[0] ||
    "Medlem";

  const row: MemberRow = {
    id: memberId,
    email,
    name: fallbackName,
    is_active: true,
    owner_user_id: ownerUserId || String(matchedUser.id ?? "").trim() || null,
    customer_type: "PT-kunde",
  };

  const { error: upsertError } = await adminClient.from("members").upsert(
    {
      id: memberId,
      owner_user_id: row.owner_user_id,
      name: fallbackName,
      email,
      is_active: true,
      membership_type: "Standard",
      customer_type: "PT-kunde",
      days_since_activity: "0",
      goal: "",
      focus: "",
      personal_goals: "",
      injuries: "",
      coach_notes: "",
    },
    { onConflict: "id" },
  );
  if (upsertError) {
    throw new Error(`Kunne ikke opprette medlemsrad: ${upsertError.message}`);
  }
  return row;
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

  let payload: RestorePayload;
  try {
    payload = (await req.json()) as RestorePayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const email = normalizeEmail(payload.email);
  const ownerUserId = String(payload.ownerUserId ?? "").trim();
  const lookupOnly = payload.lookupOnly === true;
  if (!email || !email.includes("@")) {
    return jsonResponse(400, { error: "Valid email is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    let matchingRows = await listMembersByEmail(adminClient, email);
    let recreated = false;

    if (!matchingRows.length && ownerUserId && !lookupOnly) {
      const recreatedRow = await recreateMemberFromAuth(adminClient, email, ownerUserId);
      if (recreatedRow) {
        matchingRows = [recreatedRow];
        recreated = true;
      }
    }

    if (!matchingRows.length) {
      return jsonResponse(404, {
        error: "Ingen klient funnet med denne e-posten",
        email,
        lookupOnly,
      });
    }

    if (lookupOnly) {
      return jsonResponse(200, {
        email,
        lookupOnly: true,
        members: matchingRows.map((row) => ({
          id: String(row.id ?? ""),
          email: normalizeEmail(row.email),
          name: String(row.name ?? "").trim(),
          isActive: row.is_active !== false,
          ownerUserId: String(row.owner_user_id ?? "").trim(),
          customerType: String(row.customer_type ?? "").trim(),
        })),
      });
    }

    const restoredIds: string[] = [];
    for (const row of matchingRows) {
      const id = String(row.id ?? "").trim();
      if (!id) continue;
      const patch: Record<string, unknown> = {
        is_active: true,
      };
      const currentOwner = String(row.owner_user_id ?? "").trim();
      if (ownerUserId && !isSharedMedlem(row.customer_type) && (!currentOwner || currentOwner === ownerUserId)) {
        patch.owner_user_id = ownerUserId;
      }
      const { error } = await adminClient.from("members").update(patch).eq("id", id);
      if (error) {
        return jsonResponse(500, { error: error.message, memberId: id });
      }
      restoredIds.push(id);
    }

    const reactivatedCount = matchingRows.filter((row) => row.is_active === false).length;
    return jsonResponse(200, {
      message: recreated ? "Member row recreated and restored" : "Member restored",
      restoredCount: restoredIds.length,
      reactivatedCount,
      recreated,
      memberIds: restoredIds,
    });
  } catch (error) {
    return jsonResponse(500, { error: String(error) });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CreateTrainerMemberPayload = {
  accessToken?: string;
  memberId?: string;
  name?: string;
  email?: string;
  phone?: string;
  goal?: string;
  focus?: string;
  membershipType?: string;
  customerType?: string;
  ownerUserId?: string;
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

function isTrainerUser(user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): boolean {
  const appRole = String(user.app_metadata?.role ?? "").trim().toLowerCase();
  if (appRole === "trainer") return true;
  const metaRole = String(user.user_metadata?.role ?? "").trim().toLowerCase();
  return metaRole === "trainer";
}

function canCreateAsTrainer(
  user: { id: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> },
  ownerUserId: string,
): boolean {
  if (isTrainerUser(user)) return true;
  return Boolean(ownerUserId && user.id === ownerUserId.trim());
}

function mapMembershipType(value: unknown): string {
  const normalized = String(value ?? "").trim();
  return normalized === "Premium" ? "Premium" : "Standard";
}

function mapCustomerType(value: unknown): string {
  const normalized = String(value ?? "").trim();
  if (normalized === "Medlem") return "Medlem";
  if (normalized === "PT-kunde" || normalized === "Premium-kunde") return "PT-kunde";
  if (normalized === "Oppfølging") return "Oppfølging";
  return "PT-kunde";
}

function resolveOwnerUserId(customerType: string, sessionOwnerId: string): string {
  if (customerType.toLowerCase() === "medlem") return sessionOwnerId;
  return sessionOwnerId;
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
    return jsonResponse(500, { error: "Missing Supabase environment variables" });
  }

  let payload: CreateTrainerMemberPayload;
  try {
    payload = (await req.json()) as CreateTrainerMemberPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const email = normalizeEmail(payload.email);
  const name = String(payload.name ?? "").trim();
  const memberId = String(payload.memberId ?? "").trim() || crypto.randomUUID();
  const accessToken = String(payload.accessToken ?? "").trim();
  const ownerUserIdHint = String(payload.ownerUserId ?? "").trim();

  if (!email || !email.includes("@")) {
    return jsonResponse(400, { error: "Valid email is required" });
  }
  if (!name) {
    return jsonResponse(400, { error: "Name is required" });
  }
  if (!accessToken) {
    return jsonResponse(401, { error: "accessToken is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await adminClient.auth.getUser(accessToken);
  if (userErr || !user?.id) {
    return jsonResponse(401, { error: "Invalid trainer session" });
  }
  if (!canCreateAsTrainer(user, ownerUserIdHint)) {
    return jsonResponse(403, { error: "Only trainers can create members" });
  }

  const sessionOwnerId = ownerUserIdHint || user.id;
  const customerType = mapCustomerType(payload.customerType);
  const membershipType = mapMembershipType(payload.membershipType);
  const ownerUserId = resolveOwnerUserId(customerType, sessionOwnerId);

  const { data: existingRows, error: existingError } = await adminClient
    .from("members")
    .select("id, email, is_active, owner_user_id, customer_type, membership_type")
    .ilike("email", email);
  if (existingError) {
    return jsonResponse(500, { error: existingError.message });
  }

  const exactMatches = (existingRows ?? []).filter(
    (row) => normalizeEmail(String((row as { email?: string }).email ?? "")) === email,
  );
  const activeMatch = exactMatches.find((row) => (row as { is_active?: boolean }).is_active !== false);
  if (activeMatch) {
    return jsonResponse(409, {
      error: "email_exists",
      message: "E-post finnes allerede som aktiv kunde.",
      memberId: String((activeMatch as { id?: string }).id ?? ""),
    });
  }

  const phone = String(payload.phone ?? "").trim() || "900 00 000";
  const goal = String(payload.goal ?? "").trim() || "Nytt mål settes her";
  const focus = String(payload.focus ?? "").trim() || "Ikke satt";

  const { data: inserted, error: insertError } = await adminClient
    .from("members")
    .upsert(
      {
        id: memberId,
        owner_user_id: ownerUserId,
        name,
        email,
        is_active: true,
        invited_at: null,
        phone,
        birth_date: "",
        weight: "",
        height: "",
        level: "Nybegynner",
        membership_type: membershipType,
        customer_type: customerType,
        days_since_activity: "0",
        goal,
        focus,
        personal_goals: "",
        injuries: "Ingen info ennå",
        coach_notes: "",
        avatar_url: "",
        created_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select(
      "id, owner_user_id, name, email, is_active, invited_at, phone, birth_date, weight, height, level, membership_type, customer_type, days_since_activity, goal, focus, personal_goals, injuries, coach_notes, avatar_url",
    )
    .single();

  if (insertError || !inserted) {
    return jsonResponse(500, { error: insertError?.message ?? "Could not create member" });
  }

  return jsonResponse(200, {
    ok: true,
    member: {
      id: String(inserted.id),
      ownerUserId: String(inserted.owner_user_id ?? ""),
      name: String(inserted.name ?? ""),
      email: String(inserted.email ?? ""),
      isActive: inserted.is_active !== false,
      invitedAt: String(inserted.invited_at ?? ""),
      phone: String(inserted.phone ?? ""),
      birthDate: String(inserted.birth_date ?? ""),
      weight: String(inserted.weight ?? ""),
      height: String(inserted.height ?? ""),
      level: inserted.level === "Litt øvet" || inserted.level === "Øvet" ? inserted.level : "Nybegynner",
      membershipType: inserted.membership_type === "Premium" ? "Premium" : "Standard",
      customerType: String(inserted.customer_type ?? "PT-kunde"),
      daysSinceActivity: String(inserted.days_since_activity ?? "0"),
      goal: String(inserted.goal ?? ""),
      focus: String(inserted.focus ?? ""),
      personalGoals: String(inserted.personal_goals ?? ""),
      injuries: String(inserted.injuries ?? ""),
      coachNotes: String(inserted.coach_notes ?? ""),
      avatarUrl: String(inserted.avatar_url ?? ""),
    },
  });
});

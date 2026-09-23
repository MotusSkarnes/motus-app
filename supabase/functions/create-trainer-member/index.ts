import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  canUpsertTrainerOwnedMember,
  isTrainerCaller,
  normalizeTrainerMutationEmail,
  type TrainerMutationAuthUser,
} from "../_shared/trainerMemberMutationSecurity.ts";

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
  return normalizeTrainerMutationEmail(value);
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
  if (!isTrainerCaller(user as TrainerMutationAuthUser)) {
    return jsonResponse(403, { error: "Only trainers can create members" });
  }

  // Never trust client ownerUserId — ownership is always the authenticated trainer.
  const sessionOwnerId = user.id;
  const customerType = mapCustomerType(payload.customerType);
  const membershipType = mapMembershipType(payload.membershipType);
  const ownerUserId = resolveOwnerUserId(customerType, sessionOwnerId);

  const { data: existingById, error: existingByIdError } = await adminClient
    .from("members")
    .select("id, email, is_active, owner_user_id, customer_type, membership_type")
    .eq("id", memberId)
    .maybeSingle();
  if (existingByIdError) {
    return jsonResponse(500, { error: existingByIdError.message });
  }
  if (
    !canUpsertTrainerOwnedMember({
      requesterUserId: user.id,
      existingRow: (existingById as { id?: string; owner_user_id?: string | null } | null) ?? null,
    })
  ) {
    return jsonResponse(403, { error: "Member id belongs to another trainer" });
  }

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

  const memberRow = {
    id: memberId,
    owner_user_id: ownerUserId,
    name,
    email,
    is_active: true,
    invited_at: null,
    first_login_at: null,
    phone,
    birth_date: "",
    gender: "",
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
    created_at: new Date().toISOString(),
  };

  let insertError = (await adminClient.from("members").upsert(memberRow, { onConflict: "id" })).error;
  if (insertError) {
    const message = insertError.message.toLowerCase();
    const slimRow = { ...memberRow } as Record<string, unknown>;
    if (message.includes("gender")) delete slimRow.gender;
    if (message.includes("first_login_at")) delete slimRow.first_login_at;
    if (message.includes("invited_at")) delete slimRow.invited_at;
    if (Object.keys(slimRow).length !== Object.keys(memberRow).length) {
      insertError = (await adminClient.from("members").upsert(slimRow, { onConflict: "id" })).error;
    }
  }
  if (insertError) {
    return jsonResponse(500, { error: insertError.message });
  }

  const selectCandidates = [
    "id, owner_user_id, name, email, is_active, invited_at, first_login_at, phone, birth_date, gender, weight, height, level, membership_type, customer_type, days_since_activity, goal, focus, personal_goals, injuries, coach_notes",
    "id, owner_user_id, name, email, is_active, phone, birth_date, weight, height, level, membership_type, customer_type, days_since_activity, goal, focus, personal_goals, injuries, coach_notes",
  ];

  let inserted: Record<string, unknown> | null = null;
  for (const fields of selectCandidates) {
    const { data, error: readError } = await adminClient.from("members").select(fields).eq("id", memberId).maybeSingle();
    if (!readError && data) {
      inserted = data as Record<string, unknown>;
      break;
    }
  }

  if (!inserted) {
    return jsonResponse(200, {
      ok: true,
      member: {
        id: memberId,
        ownerUserId,
        name,
        email,
        isActive: true,
        invitedAt: "",
        firstLoginAt: "",
        phone,
        birthDate: "",
        gender: "",
        weight: "",
        height: "",
        level: "Nybegynner",
        membershipType,
        customerType,
        daysSinceActivity: "0",
        goal,
        focus,
        personalGoals: "",
        injuries: "Ingen info ennå",
        coachNotes: "",
        avatarUrl: "",
      },
    });
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
      firstLoginAt: String(inserted.first_login_at ?? ""),
      phone: String(inserted.phone ?? ""),
      birthDate: String(inserted.birth_date ?? ""),
      gender: String(inserted.gender ?? ""),
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
      avatarUrl: "",
    },
  });
});

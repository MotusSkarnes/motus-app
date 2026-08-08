import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { REASSIGN_MEMBER_OWNER_TABLES } from "../_shared/trainerMealPlanAccess.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ReassignPayload = {
  listTrainersOnly?: boolean;
  memberId?: string;
  targetOwnerUserId?: string;
  accessToken?: string;
};

type MemberRow = {
  id?: string;
  email?: string | null;
  name?: string | null;
  owner_user_id?: string | null;
  customer_type?: string | null;
  membership_type?: string | null;
  is_active?: boolean | null;
};

type AuthUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function isSharedMedlem(customerType: string | null | undefined): boolean {
  return String(customerType ?? "").trim().toLowerCase() === "medlem";
}

function isTrainerUser(user: AuthUser): boolean {
  const appRole = String(user.app_metadata?.role ?? "").trim().toLowerCase();
  const metaRole = String(user.user_metadata?.role ?? "").trim().toLowerCase();
  if (appRole === "trainer" || metaRole === "trainer") return true;
  const email = normalizeEmail(user.email);
  return email.endsWith("@motus-skarnes.no");
}

function trainerDisplayName(user: AuthUser): string {
  const meta = user.user_metadata ?? {};
  const full = String(meta.full_name ?? meta.name ?? "").trim();
  if (full) return full;
  const email = normalizeEmail(user.email);
  const local = email.split("@")[0] ?? "";
  return local.replace(/[._-]+/g, " ").trim() || "Trener";
}

async function migrateMemberDataToTrainer(
  adminClient: ReturnType<typeof createClient>,
  memberIds: string[],
  ownerUserId: string,
): Promise<void> {
  const ids = Array.from(new Set(memberIds.map((id) => id.trim()).filter(Boolean)));
  const owner = ownerUserId.trim();
  if (!ids.length || !owner) return;
  for (const table of REASSIGN_MEMBER_OWNER_TABLES) {
    const { error } = await adminClient.from(table).update({ owner_user_id: owner }).in("member_id", ids);
    if (error) {
      console.warn(`reassign-member-owner: could not migrate ${table}.owner_user_id:`, error.message);
    }
  }
}

async function listTrainerUsers(adminClient: ReturnType<typeof createClient>): Promise<AuthUser[]> {
  const trainers: AuthUser[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = (data?.users ?? []) as AuthUser[];
    for (const user of users) {
      if (isTrainerUser(user)) trainers.push(user);
    }
    if (users.length < 200) break;
    page += 1;
    if (page > 50) break;
  }
  trainers.sort((a, b) => trainerDisplayName(a).localeCompare(trainerDisplayName(b), "nb"));
  return trainers;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing Supabase service role environment variables" });
  }

  let payload: ReassignPayload = {};
  try {
    payload = (await req.json()) as ReassignPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const accessToken = bearerToken || String(payload.accessToken ?? "").trim();
  if (!accessToken) {
    return jsonResponse(401, { error: "accessToken is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user: caller },
    error: userErr,
  } = await adminClient.auth.getUser(accessToken);
  if (userErr || !caller?.id) {
    return jsonResponse(401, { error: "Invalid trainer session" });
  }
  if (!isTrainerUser(caller as AuthUser)) {
    return jsonResponse(403, { error: "Only trainers can reassign customers" });
  }

  try {
    if (payload.listTrainersOnly === true) {
      const trainers = await listTrainerUsers(adminClient);
      return jsonResponse(200, {
        trainers: trainers.map((trainer) => ({
          id: trainer.id,
          email: normalizeEmail(trainer.email),
          name: trainerDisplayName(trainer),
        })),
      });
    }

    const memberId = String(payload.memberId ?? "").trim();
    const targetOwnerUserId = String(payload.targetOwnerUserId ?? "").trim();
    if (!memberId) return jsonResponse(400, { error: "memberId is required" });
    if (!targetOwnerUserId) return jsonResponse(400, { error: "targetOwnerUserId is required" });
    if (targetOwnerUserId === caller.id) {
      return jsonResponse(400, { error: "Kunden tilhører allerede deg" });
    }

    const { data: memberRow, error: memberError } = await adminClient
      .from("members")
      .select("id, email, name, owner_user_id, customer_type, membership_type, is_active")
      .eq("id", memberId)
      .maybeSingle();
    if (memberError) return jsonResponse(500, { error: memberError.message });
    if (!memberRow) return jsonResponse(404, { error: "Kunde ikke funnet" });

    const member = memberRow as MemberRow;
    const currentOwner = String(member.owner_user_id ?? "").trim();
    if (currentOwner !== caller.id) {
      return jsonResponse(403, {
        error: "Du kan bare overføre kunder som tilhører deg",
      });
    }
    if (isSharedMedlem(member.customer_type)) {
      return jsonResponse(400, {
        error: "Medlem (felles kundetype) kan ikke overføres til annen PT her. Endre kundetype først om nødvendig.",
      });
    }

    const trainers = await listTrainerUsers(adminClient);
    const targetTrainer = trainers.find((trainer) => trainer.id === targetOwnerUserId);
    if (!targetTrainer) {
      return jsonResponse(400, { error: "Mottaker må være en registrert PT-bruker" });
    }

    const { error: updateError } = await adminClient
      .from("members")
      .update({ owner_user_id: targetOwnerUserId })
      .eq("id", memberId);
    if (updateError) return jsonResponse(500, { error: updateError.message });

    await migrateMemberDataToTrainer(adminClient, [memberId], targetOwnerUserId);

    const customerLabel =
      String(member.membership_type ?? "").trim() === "Premium" ? "Premium-kunde" : String(member.customer_type ?? "PT-kunde");

    return jsonResponse(200, {
      message: `${customerLabel} ${String(member.name ?? "").trim() || memberId} er overført til ${trainerDisplayName(targetTrainer)}.`,
      memberId,
      fromOwnerUserId: currentOwner,
      toOwnerUserId: targetOwnerUserId,
      memberName: String(member.name ?? "").trim(),
      targetTrainerName: trainerDisplayName(targetTrainer),
      targetTrainerEmail: normalizeEmail(targetTrainer.email),
    });
  } catch (error) {
    return jsonResponse(500, { error: String(error) });
  }
});

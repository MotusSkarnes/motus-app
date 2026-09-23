import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { filterTrainerAccessibleMemberIds } from "../_shared/trainerMealPlanAccess.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  memberId?: string;
  memberEmail?: string;
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

type JwtUser = {
  id: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

function roleFromUser(user: JwtUser): "member" | "trainer" {
  const app = user.app_metadata?.role;
  if (app === "member" || app === "trainer") return app;
  const um = user.user_metadata?.role;
  if (um === "member" || um === "trainer") return um;
  return "trainer";
}

function countFoodItemsInDays(days: unknown): number {
  if (!Array.isArray(days)) return 0;
  let count = 0;
  for (const day of days) {
    if (!day || typeof day !== "object") continue;
    const meals = Array.isArray((day as { meals?: unknown }).meals) ? (day as { meals: unknown[] }).meals : [];
    for (const meal of meals) {
      if (!meal || typeof meal !== "object") continue;
      const items = Array.isArray((meal as { items?: unknown }).items) ? (meal as { items: unknown[] }).items : [];
      count += items.length;
    }
  }
  return count;
}

function pickBestPlanRow(rows: Array<Record<string, unknown>>): Record<string, unknown> | null {
  if (!rows.length) return null;
  return rows.reduce((best, current) => {
    const bestCount = countFoodItemsInDays(best.days);
    const currentCount = countFoodItemsInDays(current.days);
    if (currentCount > bestCount) return current;
    if (currentCount < bestCount) return best;
    const bestAt = new Date(String(best.updated_at ?? "")).getTime() || 0;
    const currentAt = new Date(String(current.updated_at ?? "")).getTime() || 0;
    return currentAt >= bestAt ? current : best;
  });
}

async function resolveMemberIds(
  adminClient: ReturnType<typeof createClient>,
  memberId: string,
  memberEmail: string,
): Promise<string[]> {
  const ids = new Set<string>();
  const trimmedId = memberId.trim();
  if (trimmedId) ids.add(trimmedId);

  let email = normalizeEmail(memberEmail);
  if (!email.includes("@") && trimmedId) {
    const { data: row } = await adminClient.from("members").select("email").eq("id", trimmedId).maybeSingle();
    email = normalizeEmail((row as { email?: string } | null)?.email);
  }

  if (email.includes("@")) {
    const { data: rows } = await adminClient.from("members").select("id").ilike("email", email);
    for (const row of rows ?? []) {
      const id = String((row as { id?: string }).id ?? "").trim();
      if (id && id !== "__template__" && !id.startsWith("auth-")) ids.add(id);
    }
  }

  return [...ids];
}

async function trainerCanAccessMember(
  adminClient: ReturnType<typeof createClient>,
  trainerUserId: string,
  memberId: string,
): Promise<boolean> {
  const { data: memberRow } = await adminClient
    .from("members")
    .select("owner_user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (String((memberRow as { owner_user_id?: string } | null)?.owner_user_id ?? "").trim() === trainerUserId) {
    return true;
  }

  const { count: mealPlanCount } = await adminClient
    .from("member_meal_plans")
    .select("member_id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .eq("owner_user_id", trainerUserId);
  if ((mealPlanCount ?? 0) > 0) return true;

  const { count: programCount } = await adminClient
    .from("training_programs")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .eq("owner_user_id", trainerUserId);
  if ((programCount ?? 0) > 0) return true;

  const { count: logCount } = await adminClient
    .from("workout_logs")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .eq("owner_user_id", trainerUserId);
  return (logCount ?? 0) > 0;
}

async function listTrainerAccessibleMemberIds(
  adminClient: ReturnType<typeof createClient>,
  trainerUserId: string,
  memberIds: string[],
): Promise<string[]> {
  const accessible: string[] = [];
  for (const memberId of memberIds) {
    if (await trainerCanAccessMember(adminClient, trainerUserId, memberId)) {
      accessible.push(memberId);
    }
  }
  return accessible;
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

  let payload: Payload = {};
  try {
    payload = (await req.json()) as Payload;
  } catch {
    payload = {};
  }

  const memberId = String(payload.memberId ?? "").trim();
  const memberEmail = String(payload.memberEmail ?? "").trim();
  if (!memberId && !memberEmail.includes("@")) {
    return jsonResponse(400, { error: "memberId or memberEmail is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: "Invalid session token" });
  }

  const user = userData.user as JwtUser;
  if (roleFromUser(user) !== "trainer") {
    return jsonResponse(403, { error: "Only trainers can fetch member meal plans" });
  }

  const candidateMemberIds = await resolveMemberIds(adminClient, memberId, memberEmail);
  if (!candidateMemberIds.length) {
    return jsonResponse(404, { error: "No member rows found", plan: null });
  }

  const accessibleMemberIds = await listTrainerAccessibleMemberIds(adminClient, user.id, candidateMemberIds);
  const memberIds = filterTrainerAccessibleMemberIds(candidateMemberIds, accessibleMemberIds);
  if (!memberIds.length) {
    return jsonResponse(403, { error: "Not allowed to access this member meal plan" });
  }

  const { data: planRows, error: planError } = await adminClient
    .from("member_meal_plans")
    .select("member_id, title, notes, days, targets, updated_at")
    .in("member_id", memberIds);

  if (planError) {
    return jsonResponse(500, { error: planError.message });
  }

  const rows = (planRows ?? []) as Array<Record<string, unknown>>;
  const best = pickBestPlanRow(rows);
  if (!best) {
    return jsonResponse(200, { plan: null, memberIds });
  }

  const foodCount = countFoodItemsInDays(best.days);
  const dayCount = Array.isArray(best.days) ? best.days.length : 0;
  if (foodCount === 0 && dayCount === 0) {
    return jsonResponse(200, { plan: null, memberIds });
  }

  return jsonResponse(200, { plan: best, memberIds });
});

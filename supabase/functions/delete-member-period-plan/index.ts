import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  canDeleteMemberPeriodPlan,
  type MemberPeriodPlanDeleteMemberRow,
  type MemberPeriodPlanDeleteRow,
} from "../_shared/memberPeriodPlanDeleteSecurity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing Supabase service role environment variables" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return jsonResponse(401, { error: "Missing bearer token" });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData?.user) return jsonResponse(401, { error: "Invalid session token" });

  let payload: { planId?: unknown };
  try {
    payload = await req.json() as { planId?: unknown };
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const planId = normalizeString(payload.planId);
  if (!planId) return jsonResponse(400, { error: "planId is required" });

  const { data: planRowsData, error: planRowsError } = await adminClient
    .from("member_period_plans")
    .select("member_id, owner_user_id, plan")
    .eq("plan_id", planId);
  if (planRowsError) return jsonResponse(500, { error: planRowsError.message });

  const planRows = (planRowsData ?? []) as MemberPeriodPlanDeleteRow[];
  if (!planRows.length) return jsonResponse(200, { ok: true, deletedCount: 0 });

  const memberIds = Array.from(new Set(planRows.map((row) => normalizeString(row.member_id)).filter(Boolean)));
  const { data: memberRowsData, error: memberRowsError } = await adminClient
    .from("members")
    .select("id, email, is_active")
    .in("id", memberIds);
  if (memberRowsError) return jsonResponse(500, { error: memberRowsError.message });

  const memberRowsById = new Map(
    ((memberRowsData ?? []) as MemberPeriodPlanDeleteMemberRow[]).map((row) => [normalizeString(row.id), row]),
  );
  const authorizedMemberIds = planRows
    .filter((row) =>
      canDeleteMemberPeriodPlan({
        row,
        member: memberRowsById.get(normalizeString(row.member_id)),
        user: userData.user,
      }),
    )
    .map((row) => normalizeString(row.member_id))
    .filter(Boolean);

  if (!authorizedMemberIds.length) {
    return jsonResponse(403, { error: "Not authorized to delete this period plan" });
  }

  const { error: deleteError } = await adminClient
    .from("member_period_plans")
    .delete()
    .eq("plan_id", planId)
    .in("member_id", authorizedMemberIds);
  if (deleteError) return jsonResponse(500, { error: deleteError.message });

  return jsonResponse(200, { ok: true, deletedCount: authorizedMemberIds.length });
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isActiveMemberPeriodPlanRow,
  isMemberPeriodPlanRowAuthorized,
  readTrustedMemberId,
} from "../_shared/memberPeriodPlanAuthorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UpsertMemberPeriodPlanPayload = {
  memberIds?: string[];
  memberId?: string;
  targetEmail?: string;
  plan?: Record<string, unknown>;
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

function normalizeEmail(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function resolveEndpointUserRole(user: {
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): string {
  const appRole = normalizeString(user.app_metadata?.role).toLowerCase();
  const metaRole = normalizeString(user.user_metadata?.role).toLowerCase();
  if (appRole === "member" || metaRole === "member") return "member";
  if (appRole === "trainer" || metaRole === "trainer") return "trainer";
  if (normalizeEmail(user.email).endsWith("@motus-skarnes.no") && readTrustedMemberId(user)) return "member";
  if (normalizeEmail(user.email).endsWith("@motus-skarnes.no")) return "trainer";
  return appRole || metaRole || "";
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

  let payload: UpsertMemberPeriodPlanPayload;
  try {
    payload = (await req.json()) as UpsertMemberPeriodPlanPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const plan = payload.plan && typeof payload.plan === "object" ? payload.plan : null;
  const planId = normalizeString(plan?.id);
  if (!plan || !planId) return jsonResponse(400, { error: "plan.id is required" });

  const memberIds = Array.from(
    new Set([payload.memberId, ...(Array.isArray(payload.memberIds) ? payload.memberIds : [])].map(normalizeString).filter(Boolean)),
  );
  const targetEmail = normalizeEmail(payload.targetEmail);
  if (!memberIds.length && !targetEmail) return jsonResponse(400, { error: "memberId or targetEmail is required" });

  let memberRows: Array<Record<string, unknown>> = [];
  if (memberIds.length) {
    const { data, error } = await adminClient
      .from("members")
      .select("id, email, owner_user_id, customer_type, membership_type, nutrition_access, is_active, created_at")
      .in("id", memberIds);
    if (error) return jsonResponse(500, { error: error.message });
    memberRows = [...memberRows, ...((data ?? []) as Array<Record<string, unknown>>)];
  }
  if (targetEmail) {
    const { data, error } = await adminClient
      .from("members")
      .select("id, email, owner_user_id, customer_type, membership_type, nutrition_access, is_active, created_at")
      .ilike("email", targetEmail);
    if (error) return jsonResponse(500, { error: error.message });
    memberRows = [...memberRows, ...((data ?? []) as Array<Record<string, unknown>>)];
  }

  const uniqueRows = Array.from(new Map(memberRows.map((row) => [normalizeString(row.id), row])).values()).filter((row) =>
    normalizeString(row.id),
  );
  if (!uniqueRows.length) return jsonResponse(404, { error: "Member not found" });

  const user = userData.user;
  const requesterId = normalizeString(user.id);
  const requesterRole = resolveEndpointUserRole(user);
  const trustedMemberId = readTrustedMemberId(user as { app_metadata?: Record<string, unknown> });

  const authorizedRows = uniqueRows.filter((row) =>
    isMemberPeriodPlanRowAuthorized(
      { id: requesterId, email: user.email, role: requesterRole, memberId: trustedMemberId },
      row,
    ),
  );
  if (!authorizedRows.length) return jsonResponse(403, { error: "Not authorized to save period plan for this member" });
  const activeAuthorizedRows = authorizedRows.filter(isActiveMemberPeriodPlanRow);
  if (!activeAuthorizedRows.length) {
    return jsonResponse(403, {
      error: "member_archived",
      message: "Kundekontoen er arkivert. Kontakt din PT for å gjenåpne tilgang til appen.",
    });
  }

  const canonical =
    activeAuthorizedRows.find((row) => normalizeString(row.owner_user_id)) ??
    activeAuthorizedRows.find((row) => normalizeString(row.id) === trustedMemberId) ??
    activeAuthorizedRows[0];
  const canonicalMemberId = normalizeString(canonical.id);
  let ownerUserId = normalizeString(canonical.owner_user_id);
  if (!ownerUserId && requesterRole === "trainer") ownerUserId = requesterId;
  if (!ownerUserId) return jsonResponse(409, { error: "Could not resolve trainer owner for member period plan" });

  const planPayload = {
    ...plan,
    trainerSavedAtIso: normalizeString(plan.trainerSavedAtIso) || new Date().toISOString(),
  };
  const { error: upsertError } = await adminClient.from("member_period_plans").upsert(
    [
      {
        member_id: canonicalMemberId,
        plan_id: planId,
        owner_user_id: ownerUserId,
        plan: planPayload,
      },
    ],
    { onConflict: "member_id,plan_id" },
  );
  if (upsertError) return jsonResponse(500, { error: upsertError.message });

  const duplicateIds = activeAuthorizedRows
    .map((row) => normalizeString(row.id))
    .filter((id) => id && id !== canonicalMemberId);
  if (duplicateIds.length) {
    await adminClient.from("member_period_plans").delete().eq("plan_id", planId).in("member_id", duplicateIds);
  }

  return jsonResponse(200, { ok: true, memberId: canonicalMemberId, ownerUserId });
});

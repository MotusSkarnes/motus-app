import { readLinkedMealPlanMemberIds } from "./mealPlanCloud";
import {
  loadMemberMealPlanState,
  mergeMemberMealPlanStates,
  parseMemberMealPlanState,
  saveMemberMealPlanState,
  type MemberMealPlanState,
} from "./memberMealPlanState";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";

function isStateTableMissing(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("member_meal_plan_state") &&
    (m.includes("does not exist") || m.includes("schema cache") || m.includes("pgrst204") || m.includes("could not find"))
  );
}

async function fetchStateRow(memberId: string): Promise<MemberMealPlanState | null> {
  if (!supabaseClient || !memberId.trim()) return null;
  const { data, error } = await supabaseClient
    .from("member_meal_plan_state")
    .select("state, updated_at")
    .eq("member_id", memberId.trim())
    .maybeSingle();
  if (error) {
    if (!isStateTableMissing(error.message)) {
      console.warn("member_meal_plan_state fetch failed:", memberId, error.message);
    }
    return null;
  }
  if (!data) return null;
  const row = data as { state?: unknown; updated_at?: string };
  const parsed = parseMemberMealPlanState(row.state);
  if (row.updated_at) {
    parsed.updatedAt = row.updated_at;
  }
  return parsed;
}

export async function fetchMemberMealPlanStateFromSupabase(memberIds: string | string[]): Promise<MemberMealPlanState | null> {
  const ids = [...new Set((Array.isArray(memberIds) ? memberIds : [memberIds]).map((id) => id.trim()).filter(Boolean))];
  let best: MemberMealPlanState | null = null;
  let bestMs = 0;
  for (const id of ids) {
    const row = await fetchStateRow(id);
    if (!row) continue;
    const ms = Date.parse(row.updatedAt ?? "") || 0;
    if (!best || ms >= bestMs) {
      best = row;
      bestMs = ms;
    }
  }
  return best;
}

export async function saveMemberMealPlanStateToSupabase(
  memberId: string,
  state: MemberMealPlanState,
): Promise<boolean> {
  if (!supabaseClient || !memberId.trim()) return false;
  const updatedAt = new Date().toISOString();
  const payload = { ...state, updatedAt };
  const { error } = await supabaseClient.from("member_meal_plan_state").upsert(
    {
      member_id: memberId.trim(),
      state: payload,
      updated_at: updatedAt,
    },
    { onConflict: "member_id" },
  );
  if (error) {
    if (!isStateTableMissing(error.message)) {
      console.warn("member_meal_plan_state save failed:", error.message);
    }
    return false;
  }
  return true;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: { memberId: string; state: MemberMealPlanState } | null = null;

export function scheduleMemberMealPlanStateCloudSave(memberId: string, state: MemberMealPlanState): void {
  if (!memberId.trim() || !isSupabaseConfigured) return;
  pendingSave = { memberId, state };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const payload = pendingSave;
    pendingSave = null;
    saveTimer = null;
    if (!payload) return;
    void saveMemberMealPlanStateToSupabase(payload.memberId, payload.state);
  }, 500);
}

export function persistMemberMealPlanStateLocalAndScheduleCloud(memberId: string, state: MemberMealPlanState): void {
  saveMemberMealPlanState(memberId, state);
  scheduleMemberMealPlanStateCloudSave(memberId, state);
}

export async function syncMemberMealPlanState(memberId: string): Promise<MemberMealPlanState> {
  const lookupIds = await readLinkedMealPlanMemberIds(memberId);
  const primaryId = memberId.trim() || lookupIds[0] || "";
  const local = loadMemberMealPlanState(primaryId);
  const remote = await fetchMemberMealPlanStateFromSupabase(lookupIds);
  if (!remote) return local;
  const merged = mergeMemberMealPlanStates(local, remote);
  saveMemberMealPlanState(primaryId, merged, { notify: false });
  return merged;
}

export function applyHydratedMemberMealPlanState(memberId: string, state: MemberMealPlanState): void {
  const id = memberId.trim();
  if (!id) return;
  const local = loadMemberMealPlanState(id);
  const merged = mergeMemberMealPlanStates(local, state);
  saveMemberMealPlanState(id, merged);
}

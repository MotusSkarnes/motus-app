import { mergeMemberSavedMeals } from "./memberSavedMeals";
import { readLinkedMealPlanMemberIds } from "./mealPlanCloud";
import {
  loadMemberMealPlanState,
  mergeMemberMealPlanStates,
  parseMemberMealPlanState,
  saveMemberMealPlanState,
  stateUpdatedAtMs,
  type MemberMealPlanState,
  type MemberQuickFoodLogEntry,
} from "./memberMealPlanState";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";

function isStateTableMissing(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("member_meal_plan_state") &&
    (m.includes("does not exist") || m.includes("schema cache") || m.includes("pgrst204") || m.includes("could not find"))
  );
}

type FetchedMealPlanStateRow = {
  state: MemberMealPlanState | null;
  /** True when the read failed for a reason other than a missing table. */
  failed: boolean;
};

async function fetchStateRow(memberId: string): Promise<FetchedMealPlanStateRow> {
  if (!supabaseClient || !memberId.trim()) return { state: null, failed: false };
  const { data, error } = await supabaseClient
    .from("member_meal_plan_state")
    .select("state, updated_at")
    .eq("member_id", memberId.trim())
    .maybeSingle();
  if (error) {
    if (!isStateTableMissing(error.message)) {
      console.warn("member_meal_plan_state fetch failed:", memberId, error.message);
    }
    return { state: null, failed: !isStateTableMissing(error.message) };
  }
  if (!data) return { state: null, failed: false };
  const row = data as { state?: unknown; updated_at?: string };
  const parsed = parseMemberMealPlanState(row.state);
  if (row.updated_at) {
    parsed.updatedAt = row.updated_at;
  }
  return { state: parsed, failed: false };
}

async function fetchMemberMealPlanStatesTracked(memberIds: string[]): Promise<{ state: MemberMealPlanState | null; failed: boolean }> {
  let primaryFailed = false;
  const states: MemberMealPlanState[] = [];
  for (let index = 0; index < memberIds.length; index += 1) {
    const row = await fetchStateRow(memberIds[index] ?? "");
    if (row.failed && index === 0) primaryFailed = true;
    if (row.state) states.push(row.state);
  }
  return { state: mergeMemberMealPlanStateList(states), failed: primaryFailed };
}

export async function fetchMemberMealPlanStateFromSupabase(memberIds: string | string[]): Promise<MemberMealPlanState | null> {
  const ids = [...new Set((Array.isArray(memberIds) ? memberIds : [memberIds]).map((id) => id.trim()).filter(Boolean))];
  const fetched = await fetchMemberMealPlanStatesTracked(ids);
  return fetched.state;
}

function unionIdLists(target: Record<string, string[]>, incoming: Record<string, string[]> | undefined): void {
  if (!incoming) return;
  for (const [key, ids] of Object.entries(incoming)) {
    if (!Array.isArray(ids)) continue;
    if (ids.length === 0) {
      if (!target[key]) target[key] = [];
      continue;
    }
    target[key] = [...new Set([...(target[key] ?? []), ...ids])];
  }
}

function unionQuickFoodLogs(
  target: MemberMealPlanState["quickFoodLogs"],
  incoming: MemberMealPlanState["quickFoodLogs"] | undefined,
): void {
  if (!incoming) return;
  for (const [dateKey, entries] of Object.entries(incoming)) {
    if (!Array.isArray(entries)) continue;
    if (entries.length === 0) {
      if (!target[dateKey]) target[dateKey] = [];
      continue;
    }
    const byId = new Map<string, MemberQuickFoodLogEntry>((target[dateKey] ?? []).map((entry) => [entry.id, entry]));
    for (const entry of entries) {
      if (!entry?.id) continue;
      byId.set(entry.id, entry);
    }
    if (byId.size > 0) target[dateKey] = [...byId.values()];
  }
}

/** Slår sammen rader for samme person. Samme dag beholdes fra alle identiteter, og tidsstempelet er kildenes — ikke «nå». */
export function mergeMemberMealPlanStateList(states: MemberMealPlanState[]): MemberMealPlanState | null {
  const present = states.filter((state) => Boolean(state));
  if (present.length === 0) return null;
  const ordered = [...present].sort((a, b) => stateUpdatedAtMs(a) - stateUpdatedAtMs(b));
  const latestMs = ordered.reduce((max, state) => Math.max(max, stateUpdatedAtMs(state)), 0);
  const loggedMeals: Record<string, string[]> = {};
  const loggedFoodIds: Record<string, string[]> = {};
  const skippedFoodIds: Record<string, string[]> = {};
  const quickFoodLogs: MemberMealPlanState["quickFoodLogs"] = {};
  const mealSwaps: MemberMealPlanState["mealSwaps"] = {};
  const ingredientSwaps: MemberMealPlanState["ingredientSwaps"] = {};
  const waterLiters: Record<string, number> = {};
  const recipePortions: Record<string, number> = {};
  const checkedShopping = new Set<string>();
  let savedMeals: MemberMealPlanState["savedMeals"] = [];

  for (const state of ordered) {
    unionIdLists(loggedMeals, state.loggedMeals);
    unionIdLists(loggedFoodIds, state.loggedFoodIds);
    unionIdLists(skippedFoodIds, state.skippedFoodIds);
    unionQuickFoodLogs(quickFoodLogs, state.quickFoodLogs);
    Object.assign(mealSwaps, state.mealSwaps);
    Object.assign(ingredientSwaps, state.ingredientSwaps);
    Object.assign(waterLiters, state.waterLiters);
    Object.assign(recipePortions, state.recipePortions);
    for (const key of state.checkedShopping ?? []) checkedShopping.add(key);
    savedMeals = mergeMemberSavedMeals(savedMeals, state.savedMeals ?? []);
  }

  return {
    loggedMeals,
    loggedFoodIds,
    waterLiters,
    checkedShopping: [...checkedShopping],
    recipePortions,
    mealSwaps,
    ingredientSwaps,
    quickFoodLogs,
    skippedFoodIds,
    savedMeals,
    updatedAt: latestMs > 0 ? new Date(latestMs).toISOString() : undefined,
  };
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
      return false;
    }
    return saveMemberMealPlanStateViaEdge(memberId, payload);
  }
  return true;
}

async function saveMemberMealPlanStateViaEdge(memberId: string, state: MemberMealPlanState): Promise<boolean> {
  if (!supabaseClient) return false;
  const { data, error } = await supabaseClient.functions.invoke("persist-member-meal-plan-state", {
    body: { memberId: memberId.trim(), state },
  });
  if (error) {
    console.warn("persist-member-meal-plan-state failed:", error.message);
    return false;
  }
  return (data as { ok?: boolean } | null)?.ok === true;
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

export type SyncMemberMealPlanStateOptions = {
  /** Trainer views must not publish a merged snapshot over the client's row. */
  writeBack?: boolean;
};

export function shouldWriteMealPlanStateToCloud(input: {
  writeBack: boolean;
  fetchFailed: boolean;
  remote: MemberMealPlanState | null;
  merged: MemberMealPlanState;
}): boolean {
  if (!input.writeBack || input.fetchFailed) return false;
  if (!input.remote) return stateHasTrackedActivity(input.merged);
  return !memberMealPlanStatesEqual(input.merged, input.remote);
}

export async function syncMemberMealPlanState(
  memberId: string,
  aliasMemberIds: string[] = [],
  options?: SyncMemberMealPlanStateOptions,
): Promise<MemberMealPlanState> {
  const writeBack = options?.writeBack !== false;
  const linkedIds = await readLinkedMealPlanMemberIds(memberId);
  const lookupIds = [...new Set([memberId.trim(), ...aliasMemberIds, ...linkedIds].map((id) => id.trim()).filter(Boolean))];
  const primaryId = memberId.trim() || lookupIds[0] || "";
  const fetched = await fetchMemberMealPlanStatesTracked(lookupIds);
  // Reload local after the network round-trip so a delete/add during fetch is not overwritten.
  const local = mergeMemberMealPlanStateList(lookupIds.map((id) => loadMemberMealPlanState(id))) ??
    loadMemberMealPlanState(primaryId);
  if (fetched.failed) return local;
  const remote = fetched.state;
  if (!remote) {
    saveMemberMealPlanState(primaryId, local);
    if (shouldWriteMealPlanStateToCloud({ writeBack, fetchFailed: false, remote: null, merged: local })) {
      await saveMemberMealPlanStateToSupabase(primaryId, local);
    }
    return local;
  }
  const merged = mergeMemberMealPlanStates(local, remote);
  saveMemberMealPlanState(primaryId, merged);
  if (shouldWriteMealPlanStateToCloud({ writeBack, fetchFailed: false, remote, merged })) {
    await saveMemberMealPlanStateToSupabase(primaryId, merged);
  }
  return merged;
}

function stateHasTrackedActivity(state: MemberMealPlanState): boolean {
  return (
    Object.values(state.loggedMeals).some((ids) => ids.length > 0) ||
    Object.values(state.loggedFoodIds).some((ids) => ids.length > 0) ||
    Object.values(state.quickFoodLogs).some((rows) => rows.length > 0) ||
    Object.values(state.skippedFoodIds).some((ids) => ids.length > 0) ||
    Object.keys(state.mealSwaps).length > 0 ||
    Object.keys(state.ingredientSwaps).length > 0
  );
}

function memberMealPlanStatesEqual(a: MemberMealPlanState, b: MemberMealPlanState): boolean {
  const { updatedAt: _aUpdatedAt, ...aContent } = a;
  const { updatedAt: _bUpdatedAt, ...bContent } = b;
  return JSON.stringify(aContent) === JSON.stringify(bContent);
}

export function applyHydratedMemberMealPlanState(memberId: string, state: MemberMealPlanState): boolean {
  const id = memberId.trim();
  if (!id) return false;
  const local = loadMemberMealPlanState(id);
  const merged = mergeMemberMealPlanStates(local, state);
  if (memberMealPlanStatesEqual(local, merged)) return false;
  saveMemberMealPlanState(id, merged);
  return true;
}

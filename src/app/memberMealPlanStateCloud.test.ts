import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadMemberMealPlanState,
  type MemberMealPlanState,
  type MemberQuickFoodLogEntry,
} from "./memberMealPlanState";
import { syncMemberMealPlanState, updateMemberMealPlanStateLocalAndScheduleCloud } from "./memberMealPlanStateCloud";

const mocks = vi.hoisted(() => ({
  readLinkedMealPlanMemberIds: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("./mealPlanCloud", () => ({
  readLinkedMealPlanMemberIds: mocks.readLinkedMealPlanMemberIds,
}));

vi.mock("../services/supabaseClient", () => ({
  isSupabaseConfigured: false,
  supabaseClient: {
    from: mocks.from,
  },
}));

function makeEntry(id: string): MemberQuickFoodLogEntry {
  return {
    id,
    name: id,
    grams: 100,
    source: "food",
    loggedAt: `2026-05-30T10:00:0${id === "first" ? "1" : "2"}.000Z`,
    nutritionPer100g: {
      kcal: 100,
      protein: 10,
      carbs: 12,
      fat: 3,
      fiber: 1,
      sugar: 2,
      saturatedFat: 1,
      sodium: 50,
    },
  };
}

function addQuickLog(memberId: string, dateKey: string, entry: MemberQuickFoodLogEntry): MemberMealPlanState {
  return updateMemberMealPlanStateLocalAndScheduleCloud(memberId, (current) => ({
    ...current,
    quickFoodLogs: {
      ...current.quickFoodLogs,
      [dateKey]: [entry, ...(current.quickFoodLogs[dateKey] ?? [])],
    },
    updatedAt: entry.loggedAt,
  }));
}

function emptyState(updatedAt?: string): MemberMealPlanState {
  return {
    loggedMeals: {},
    loggedFoodIds: {},
    waterLiters: {},
    checkedShopping: [],
    recipePortions: {},
    mealSwaps: {},
    quickFoodLogs: {},
    skippedFoodIds: {},
    updatedAt,
  };
}

function installSupabaseStateFetch(result: Promise<unknown> | unknown): void {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: mocks.maybeSingle,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  mocks.maybeSingle.mockReturnValue(result);
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("member meal plan state cloud persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.readLinkedMealPlanMemberIds.mockReset();
    mocks.from.mockReset();
    mocks.maybeSingle.mockReset();
    mocks.readLinkedMealPlanMemberIds.mockResolvedValue([]);
    installSupabaseStateFetch({ data: null, error: null });
  });

  it("applies consecutive quick-log updates to the latest local state", () => {
    const memberId = "member-quick-log";
    const dateKey = "2026-05-30";

    addQuickLog(memberId, dateKey, makeEntry("first"));
    const next = addQuickLog(memberId, dateKey, makeEntry("second"));

    expect(next.quickFoodLogs[dateKey]?.map((entry) => entry.id)).toEqual(["second", "first"]);
    expect(loadMemberMealPlanState(memberId).quickFoodLogs[dateKey]?.map((entry) => entry.id)).toEqual([
      "second",
      "first",
    ]);
  });

  it("keeps quick logs written while remote sync is in flight", async () => {
    const memberId = "member-sync-race";
    const dateKey = "2026-05-30";
    const remoteFetch = deferred<{ data: { state: MemberMealPlanState; updated_at: string }; error: null }>();
    installSupabaseStateFetch(remoteFetch.promise);
    mocks.readLinkedMealPlanMemberIds.mockResolvedValue([memberId]);

    const syncedPromise = syncMemberMealPlanState(memberId);
    for (let i = 0; i < 3 && mocks.maybeSingle.mock.calls.length === 0; i += 1) {
      await Promise.resolve();
    }
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(1);

    addQuickLog(memberId, dateKey, makeEntry("second"));
    remoteFetch.resolve({
      data: {
        state: emptyState("2026-05-30T09:00:00.000Z"),
        updated_at: "2026-05-30T09:00:00.000Z",
      },
      error: null,
    });

    const synced = await syncedPromise;

    expect(synced.quickFoodLogs[dateKey]?.map((entry) => entry.id)).toEqual(["second"]);
    expect(loadMemberMealPlanState(memberId).quickFoodLogs[dateKey]?.map((entry) => entry.id)).toEqual(["second"]);
  });
});

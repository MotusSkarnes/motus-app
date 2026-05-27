import { parsePersonalGoalsJson, readProfileExtensions } from "./memberOnboarding";
import type { FoodItem } from "./foodBankTypes";
import { computeRecipeIngredients, type RecipeIngredient } from "./recipeMacros";

const PROFILE_METRICS_PREFIX = "MOTUS_PROFILE_V1:";

export type MemberFoodAvoidanceItem = {
  /** Matvarebank-id når valgt fra banken. */
  foodId?: string;
  /** Visningsnavn (matvare eller fritekst, f.eks. «Gluten», «Laktose»). */
  label: string;
  /** Normalisert nøkkel for treffsøk. */
  key: string;
};

export type MemberFoodAvoidances = {
  items: MemberFoodAvoidanceItem[];
  notes: string;
  updatedAt: number;
};

export function emptyMemberFoodAvoidances(): MemberFoodAvoidances {
  return { items: [], notes: "", updatedAt: 0 };
}

export function normalizeAvoidanceKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9æøå]+/g, "")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/æ/g, "ae");
}

export function foodAvoidanceFromFoodItem(food: FoodItem): MemberFoodAvoidanceItem {
  return {
    foodId: food.id,
    label: food.name,
    key: normalizeAvoidanceKey(food.name),
  };
}

export function foodAvoidanceFromLabel(label: string): MemberFoodAvoidanceItem | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const key = normalizeAvoidanceKey(trimmed);
  if (key.length < 2) return null;
  return { label: trimmed, key };
}

function normalizeAvoidances(raw: unknown): MemberFoodAvoidances {
  if (!raw || typeof raw !== "object") return emptyMemberFoodAvoidances();
  const record = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(record.items) ? record.items : [];
  const byKey = new Map<string, MemberFoodAvoidanceItem>();
  for (const row of itemsRaw) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const label = String(item.label ?? "").trim();
    const key = normalizeAvoidanceKey(String(item.key ?? label));
    if (!label || !key) continue;
    const foodId = String(item.foodId ?? "").trim();
    byKey.set(key, {
      label,
      key,
      ...(foodId ? { foodId } : {}),
    });
  }
  return {
    items: Array.from(byKey.values()),
    notes: String(record.notes ?? "").trim(),
    updatedAt: Number(record.updatedAt) || 0,
  };
}

export function readMemberFoodAvoidancesFromPersonalGoals(
  personalGoals: string | undefined,
): MemberFoodAvoidances {
  const payload = parsePersonalGoalsJson(personalGoals);
  if (!payload?.foodAvoidances) return emptyMemberFoodAvoidances();
  return normalizeAvoidances(payload.foodAvoidances);
}

export function mergeMemberFoodAvoidancesIntoPersonalGoals(
  existingPersonalGoals: string | undefined,
  avoidances: MemberFoodAvoidances,
): string {
  const existing = parsePersonalGoalsJson(existingPersonalGoals) ?? {};
  const extensions = readProfileExtensions(existingPersonalGoals);
  const payload = {
    ...existing,
    ...extensions,
    foodAvoidances: {
      items: avoidances.items,
      notes: avoidances.notes.trim(),
      updatedAt: Date.now(),
    },
  };
  return `${PROFILE_METRICS_PREFIX}${JSON.stringify(payload)}`;
}

export function patchMemberFoodAvoidancesInPersonalGoals(
  existingPersonalGoals: string | undefined,
  avoidances: MemberFoodAvoidances,
): string {
  return mergeMemberFoodAvoidancesIntoPersonalGoals(existingPersonalGoals, {
    ...avoidances,
    updatedAt: Date.now(),
  });
}

export type RecipeFoodAvoidanceConflict = {
  memberId: string;
  memberName: string;
  avoidanceLabel: string;
  ingredientLabel: string;
};

type MemberAvoidanceSource = {
  id: string;
  name: string;
  email?: string;
  personalGoals?: string;
  isActive?: boolean;
};

function ingredientMatchesAvoidance(ingredient: RecipeIngredient, avoidance: MemberFoodAvoidanceItem): boolean {
  if (avoidance.foodId && ingredient.foodId === avoidance.foodId) return true;

  const avoidKey = avoidance.key;
  if (!avoidKey || avoidKey.length < 2) return false;

  const foodKey = normalizeAvoidanceKey(ingredient.foodName);
  const lineKey = normalizeAvoidanceKey(ingredient.sourceLine);

  if (foodKey === avoidKey || lineKey === avoidKey) return true;
  if (foodKey.includes(avoidKey) || avoidKey.includes(foodKey)) return true;
  if (lineKey.includes(avoidKey)) return true;

  const tokens = avoidKey.match(/[a-z0-9]{3,}/g) ?? [];
  if (tokens.length >= 2 && tokens.every((token) => foodKey.includes(token) || lineKey.includes(token))) {
    return true;
  }

  return false;
}

export function findRecipeFoodAvoidanceConflicts(
  recipeBody: string,
  foodItems: FoodItem[],
  members: MemberAvoidanceSource[],
): RecipeFoodAvoidanceConflict[] {
  const ingredients = computeRecipeIngredients(recipeBody, foodItems);
  if (!ingredients.length) return [];

  const conflicts: RecipeFoodAvoidanceConflict[] = [];
  const seen = new Set<string>();

  for (const member of members) {
    if (member.isActive === false) continue;
    const avoidances = readMemberFoodAvoidancesFromPersonalGoals(member.personalGoals);
    if (!avoidances.items.length) continue;

    const memberName = member.name.trim() || member.email?.trim() || "Medlem";

    for (const avoidance of avoidances.items) {
      for (const ingredient of ingredients) {
        if (!ingredientMatchesAvoidance(ingredient, avoidance)) continue;
        const dedupe = `${member.id}:${avoidance.key}:${ingredient.foodId}:${ingredient.sourceLine}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        conflicts.push({
          memberId: member.id,
          memberName,
          avoidanceLabel: avoidance.label,
          ingredientLabel: ingredient.foodName,
        });
      }
    }
  }

  return conflicts.sort((a, b) => a.memberName.localeCompare(b.memberName, "no"));
}

export function summarizeRecipeFoodAvoidanceConflicts(
  conflicts: RecipeFoodAvoidanceConflict[],
): string {
  if (!conflicts.length) return "";
  const byMember = new Map<string, { name: string; hits: Set<string> }>();
  for (const row of conflicts) {
    const bucket = byMember.get(row.memberId) ?? { name: row.memberName, hits: new Set<string>() };
    bucket.hits.add(`${row.avoidanceLabel} (i ${row.ingredientLabel})`);
    byMember.set(row.memberId, bucket);
  }
  const lines = Array.from(byMember.values()).map(
    (row) => `${row.name}: ${Array.from(row.hits).join(", ")}`,
  );
  const memberCount = byMember.size;
  const header =
    memberCount === 1
      ? "1 medlem har mat de unngår i denne oppskriften"
      : `${memberCount} medlemmer har mat de unngår i denne oppskriften`;
  return `${header}:\n${lines.join("\n")}`;
}

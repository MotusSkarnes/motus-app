import { normalizeFoodBankNameKey } from "./foodBankNameKey";

export const FOOD_SOURCE_HIDDEN_KEY = "motus_food_source_hidden_v1";
export const FOOD_SOURCE_HIDDEN_CHANGED_EVENT = "motus-food-source-hidden-changed";

export type HiddenFoodSource = {
  id: string;
  name: string;
  nameKey: string;
  hiddenAt: string;
};

function readHidden(): HiddenFoodSource[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FOOD_SOURCE_HIDDEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HiddenFoodSource[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row.nameKey === "string" && row.nameKey.length > 0);
  } catch {
    return [];
  }
}

function writeHidden(entries: HiddenFoodSource[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FOOD_SOURCE_HIDDEN_KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent(FOOD_SOURCE_HIDDEN_CHANGED_EVENT));
}

export function loadHiddenFoodSources(): HiddenFoodSource[] {
  return readHidden().sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

export function hiddenFoodSourceNameKeys(entries = loadHiddenFoodSources()): Set<string> {
  return new Set(entries.map((row) => row.nameKey));
}

export function hideFoodSourceFromSuggestions(input: { id: string; name: string }): HiddenFoodSource[] {
  const name = input.name.trim();
  const nameKey = normalizeFoodBankNameKey(name);
  if (!nameKey) return loadHiddenFoodSources();
  const current = readHidden();
  if (current.some((row) => row.nameKey === nameKey)) return loadHiddenFoodSources();
  writeHidden([
    ...current,
    {
      id: input.id,
      name,
      nameKey,
      hiddenAt: new Date().toISOString(),
    },
  ]);
  return loadHiddenFoodSources();
}

export function restoreHiddenFoodSource(nameKey: string): HiddenFoodSource[] {
  const key = nameKey.trim();
  writeHidden(readHidden().filter((row) => row.nameKey !== key));
  return loadHiddenFoodSources();
}

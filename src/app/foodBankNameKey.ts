/** Felles navnenormalisering for matvarebank (søk, import, dedup). */
export function normalizeFoodBankNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9æøå]+/g, "")
    .trim();
}

const FOOD_BANK_NAME_ALIASES: Record<string, string> = {
  banana: "banan",
  eggewite: "eggehvite",
};

export function canonicalFoodBankNameKey(name: string): string {
  const key = normalizeFoodBankNameKey(name);
  return FOOD_BANK_NAME_ALIASES[key] ?? key;
}

export function foodNamePrimaryKey(name: string): string {
  const primary = name.split(",")[0]?.trim() || name;
  return canonicalFoodBankNameKey(primary);
}

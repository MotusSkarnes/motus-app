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

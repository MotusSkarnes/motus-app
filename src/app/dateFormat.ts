export function formatDateDdMmYyyy(input: Date | string | number): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}.${month}.${year}`;
}

/** Parser dato fra lagret øktlogg (dd.mm.yyyy, yyyy-mm-dd eller ISO). */
export function parseStoredLogDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isoLike = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoLike) {
    const parsed = new Date(Number(isoLike[1]), Number(isoLike[2]) - 1, Number(isoLike[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const dotted = trimmed.split(".");
  if (dotted.length >= 3) {
    const parsed = new Date(Number(dotted[2]), Number(dotted[1]) - 1, Number(dotted[0]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function normalizeStoredLogDate(value: string): string {
  const parsed = parseStoredLogDate(value);
  return parsed ? formatDateDdMmYyyy(parsed) : value.trim();
}

export function storedLogDatesMatch(a: string, b: string): boolean {
  return normalizeStoredLogDate(a) === normalizeStoredLogDate(b);
}

export function formatDateTimeDdMmYyyy(input: Date | string | number): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const datePart = formatDateDdMmYyyy(date);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${datePart} kl ${hours}:${minutes}`;
}

/**
 * Neste kommende kalendermandag (lokal tid). Er det allerede mandag — brukes i dag.
 * Brukes som standard «startdato» for periodeplan når trener ikke har valgt annet.
 */
export function getDefaultPeriodPlanStartMondayISO(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntilMonday = (8 - d.getDay()) % 7;
  d.setDate(d.getDate() + daysUntilMonday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

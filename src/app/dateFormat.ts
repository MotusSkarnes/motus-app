export function formatDateDdMmYyyy(input: Date | string | number): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}.${month}.${year}`;
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

import { formatDateDdMmYyyy } from "./dateFormat";

export function isValidEmail(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function normalizePhone(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeBirthDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) return trimmed;
  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    if (!isValidCalendarDate(day, month, year)) return trimmed;
    return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
  }
  const formatted = formatDateDdMmYyyy(trimmed);
  return formatted || trimmed;
}

export function isLikelyValidBirthDate(value: string): boolean {
  const normalized = normalizeBirthDate(value);
  if (!normalized) return true;
  const dotted = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!dotted) return false;
  return isValidCalendarDate(Number(dotted[1]), Number(dotted[2]), Number(dotted[3]));
}

function isValidCalendarDate(day: number, month: number, year: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

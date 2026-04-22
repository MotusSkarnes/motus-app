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
  const formatted = formatDateDdMmYyyy(trimmed);
  return formatted || trimmed;
}

export function isLikelyValidBirthDate(value: string): boolean {
  const normalized = normalizeBirthDate(value);
  if (!normalized) return true;
  return /^\d{2}\.\d{2}\.\d{4}$/.test(normalized);
}

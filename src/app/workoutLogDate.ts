/** Klientlogger bruker ofte norsk dd.mm.yyyy — må parses eksplisitt. */
export function parseLogDateMs(value: string): number {
  if (!value) return 0;
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    const parsed = new Date(year, month, day);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
  const iso = new Date(value);
  if (!Number.isNaN(iso.getTime())) return iso.getTime();
  return 0;
}

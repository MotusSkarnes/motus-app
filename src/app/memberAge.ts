/** Alder i hele år ut fra fødselsdato (dd.mm.yyyy eller ISO). */
export function parseMemberAgeYears(birthDate: string, at: Date = new Date()): number | null {
  const raw = birthDate.trim();
  if (!raw) return null;
  let ms = Number.NaN;
  if (raw.includes(".")) {
    const parts = raw.split(".");
    if (parts.length === 3) {
      const [day, month, year] = parts;
      ms = Date.parse(`${year}-${month}-${day}`);
    }
  } else {
    ms = Date.parse(raw);
  }
  if (!Number.isFinite(ms)) return null;
  const age = Math.floor((at.getTime() - ms) / (365.25 * 24 * 60 * 60 * 1000));
  return age >= 0 && age < 120 ? age : null;
}

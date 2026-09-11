import { normalizeFoodBankNameKey } from "./foodBankNameKey";

function nameHead(name: string): string {
  return name.split(",")[0]?.trim().toLowerCase() ?? "";
}

function nameRest(name: string): string {
  const comma = name.indexOf(",");
  return comma === -1 ? "" : name.slice(comma + 1).toLowerCase();
}

const ORGANS = ["lever", "nyre", "hjerte"] as const;

/** Products that contain the organ word but are not the organ itself. */
function isOrganProductException(name: string): boolean {
  return /postei|levertran|\btran\b|hjertego|hjertesalat|artisjokk/.test(name);
}

function organFamily(head: string, nameKey: string): string | null {
  for (const organ of ORGANS) {
    if (head === organ) return organ;
    if (nameKey.endsWith(organ) && nameKey.length > organ.length) return organ;
  }
  return null;
}

const GENERIC_SEGMENTS = new Set([
  "rå",
  "kokt",
  "stekt",
  "ovnsbakt",
  "fryst",
  "frossen",
  "fersk",
  "hermetisk",
  "tørket",
  "røkt",
  "dampet",
  "grillet",
  "norsk",
  "importert",
  "dansk",
  "svensk",
  "uspesifisert",
  "kjøpt",
  "hjemmelaget",
  "økologisk",
  "rød",
  "grønn",
  "gul",
  "oransje",
  "gul/oransje",
  "filet",
  "biter",
  "skiver",
  "oppdrett",
  "vill",
  "villfanget",
  "atlantisk",
  "lett",
  "mager",
  "grov",
  "grovt",
  "fin",
  "fint",
  "avrent",
  "uten skinn",
  "med skinn",
  "uten skall",
  "med skall",
]);

const GENERIC_SEGMENT_PATTERN = [
  /^\d+\s*%(\s*fett)?$/,
  /^(uten|med)\s+(salt|vann|melk|sukker|jod|skinn|skall)\b/,
  /salt tilsatt jod/,
];

function restSegments(rest: string): string[] {
  return rest
    .split(",")
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

function isGenericSegment(segment: string): boolean {
  if (GENERIC_SEGMENTS.has(segment)) return true;
  if (GENERIC_SEGMENT_PATTERN.some((pattern) => pattern.test(segment))) return true;
  const words = segment.split(" ").filter(Boolean);
  return words.length > 0 && words.every((word) => GENERIC_SEGMENTS.has(word));
}

function productTypeFamily(head: string, nameKey: string): string | null {
  if (head.endsWith("leverpostei") || nameKey.endsWith("leverpostei")) return "leverpostei";
  return null;
}

/**
 * Groups near-duplicate food-bank rows so Gode matkilder keeps the strongest
 * variant: livers across animals, pâté styles, or the same food with only
 * color/prep/origin changes. Distinct foods (bryst vs lår, norvegia vs jarlsberg) stay separate.
 */
export function foodSourceFamilyKey(name: string): string {
  const trimmed = name.trim();
  const exact = normalizeFoodBankNameKey(trimmed) || trimmed.toLowerCase();
  if (!trimmed) return exact;
  const lower = trimmed.toLowerCase();
  const head = nameHead(lower);

  if (!isOrganProductException(lower)) {
    const organ = organFamily(head, exact);
    if (organ) return organ;
  }

  const product = productTypeFamily(head, exact);
  if (product) return product;

  const meaningful = restSegments(nameRest(lower)).filter((segment) => !isGenericSegment(segment));
  if (!meaningful.length) return normalizeFoodBankNameKey(head) || exact;
  return normalizeFoodBankNameKey([head, ...meaningful].join(" ")) || exact;
}

import { normalizeFoodBankNameKey } from "./foodBankNameKey";

function nameHead(name: string): string {
  return name.split(",")[0]?.trim().toLowerCase() ?? "";
}

function nameRest(name: string): string {
  const comma = name.indexOf(",");
  return comma === -1 ? "" : name.slice(comma + 1).toLowerCase();
}

/** First comma-segment, or the whole name when it is a single spice word. */
const EXCLUDE_HEADS = new Set([
  "anisfrø",
  "bakepulver",
  "buljongpulver",
  "chilipulver",
  "estragon",
  "fennikelfrø",
  "gelatin",
  "gurkemeie",
  "havsalt",
  "hvitløkspulver",
  "kakaopulver",
  "kanel",
  "kardemomme",
  "karri",
  "karripasta",
  "karve",
  "korianderfrø",
  "laurbærblad",
  "merian",
  "mineralsalt",
  "muskat",
  "natron",
  "nellik",
  "næringsgjær",
  "oregano",
  "paprikapulver",
  "safran",
  "sanasol",
  "sennepsfrø",
  "sjokoladepulver",
  "spisskummen",
  "tacokrydder",
  "urtesalt",
  "vanilje",
  "vaniljepulver",
  "vaniljesukker",
]);

const DRIED_HERB_HEADS = new Set([
  "basilikum",
  "dill",
  "gressløk",
  "koriander",
  "mynte",
  "oregano",
  "persille",
  "rosmarin",
  "timian",
]);

const DRIED_OR_GROUND = /\b(malt|pulver|tørket|torret|tørr)\b/i;

function isSpiceHeadExceptionDish(head: string): boolean {
  return /bolle|kake|kjeks|grøt|brød|pizza|ost|saus|suppe|gryte|iskrem|skinke|sild|nøtter|peanøtt/.test(head);
}

function isSupplementName(name: string): boolean {
  return /\b(nycoplus|vitaplex|tablett|kosttilskudd|multivitamin|vitaminmikstur)\b/i.test(name);
}

/**
 * True when 100 g is not a realistic eating portion, so per-100 g micronutrients
 * would overstate the food as a source (spices, salt, baking agents, yeast, tablets).
 */
export function isImpracticalHundredGramFoodSource(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  const head = nameHead(lower);
  const rest = nameRest(lower);
  const key = normalizeFoodBankNameKey(trimmed);

  if (isSpiceHeadExceptionDish(head)) return false;
  if (/\bproteinpulver\b/.test(lower) || key.includes("proteinpulver")) return false;

  if (isSupplementName(lower)) return true;
  if (EXCLUDE_HEADS.has(head)) return true;
  if (/krydder$/.test(head) || /krydder$/.test(key)) return true;
  if (head === "salt" || /^salt\b/.test(head)) return true;
  if (head === "gjær" || key.startsWith("gjaer") || key.startsWith("gjær")) return true;
  if (head === "pepper" && /\b(sort|svart|hvit|cayenne)\b/.test(rest)) return true;
  if (DRIED_HERB_HEADS.has(head) && DRIED_OR_GROUND.test(rest)) return true;
  if (head === "ingefær" && DRIED_OR_GROUND.test(rest)) return true;
  if (/(^| )(pulver|malt)$/.test(head) && DRIED_HERB_HEADS.has(head.replace(/\s+(pulver|malt)$/, ""))) return true;
  return false;
}

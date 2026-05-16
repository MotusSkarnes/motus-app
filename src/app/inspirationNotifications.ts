import type { InspirationNotificationItem } from "./inspirationStorage";

export function parseInspirationNotificationTimestamp(item: InspirationNotificationItem): number {
  const fromId = item.id.match(/^inspiration-(\d+)$/);
  if (fromId) {
    const ms = Number(fromId[1]);
    if (Number.isFinite(ms) && ms > 0) return ms;
  }
  const parsed = new Date(item.createdAt).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function inspirationAlertTypeLabel(item: InspirationNotificationItem): string {
  if (item.kind === "program") return "Nytt treningsprogram";
  if (item.kind === "periodPlan") return "Ny periodeplan";
  if (item.category === "news") return "Ny info fra senteret";
  if (item.category === "recipes") return "Ny oppskrift";
  if (item.category === "tips") return "Nytt råd";
  if (item.category === "programs") return "Nytt program";
  return "Nytt i inspirasjon";
}

/** Varseltekst i klokken — tittel er innleggets navn, detalj er type. */
export function buildInspirationNotificationAlertCopy(item: InspirationNotificationItem): {
  title: string;
  text: string;
  detail: string;
} {
  const postTitle = item.title.trim();
  const description = item.description.trim();
  const typeLabel = inspirationAlertTypeLabel(item);
  const summary =
    postTitle ||
    (description.length > 72 ? `${description.slice(0, 72)}…` : description) ||
    "Nytt innlegg i inspirasjon";

  return {
    title: summary,
    text: summary,
    detail: typeLabel,
  };
}

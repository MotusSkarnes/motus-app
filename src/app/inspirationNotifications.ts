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

/** Varseltekst i klokken — tittel beskriver type, detalj er innleggets navn. */
export function buildInspirationNotificationAlertCopy(item: InspirationNotificationItem): {
  title: string;
  text: string;
  detail: string;
} {
  const postTitle = item.title.trim();
  const description = item.description.trim();

  let title: string;
  if (item.kind === "program") {
    title = "Nytt treningsprogram i inspirasjon";
  } else if (item.kind === "periodPlan") {
    title = "Ny periodeplan i inspirasjon";
  } else if (item.category === "news") {
    title = "Ny info fra senteret";
  } else if (item.category === "recipes") {
    title = "Ny oppskrift i inspirasjon";
  } else if (item.category === "tips") {
    title = "Nytt råd i inspirasjon";
  } else if (item.category === "programs") {
    title = "Nytt i treningsprogram";
  } else {
    title = "Nytt i inspirasjon";
  }

  const detail = postTitle || (description.length > 72 ? `${description.slice(0, 72)}…` : description) || "Trykk for å åpne innlegget.";

  return {
    title,
    text: postTitle || title,
    detail,
  };
}

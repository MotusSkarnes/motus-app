import { MOTUS } from "./data";
import { estimate1RmKg } from "./personalRecordProgress";

export type MotusShareOutcome = "shared" | "downloaded" | "cancelled" | "failed";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

function fillWrappedCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let cy = y;
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i] ?? "";
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

/** Tegn badge på hvit flate (PNG har transparent bakgrunn). */
function drawBadgeImageOnCanvas(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, h);
  ctx.drawImage(image, x, y, w, h);
  ctx.restore();
}

function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("image"));
      image.src = src;
    });
  } catch {
    return null;
  }
}

function paintMotusShareBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const bg = ctx.createLinearGradient(0, 0, width, height * 1.05);
  bg.addColorStop(0, "#0d9488");
  bg.addColorStop(0.35, MOTUS.turquoise);
  bg.addColorStop(0.72, MOTUS.pink);
  bg.addColorStop(1, "#831843");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(140, 220, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(980, 420, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(200, 1680, 240, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintMotusShareHeader(
  ctx: CanvasRenderingContext2D,
  width: number,
  opts: { eyebrow: string; title: string; memberDisplayName: string; subtitle: string },
  logo: HTMLImageElement | null,
) {
  const headerH = 380;
  ctx.fillStyle = "rgba(15,23,42,0.28)";
  ctx.fillRect(0, 0, width, headerH);

  const displayName = opts.memberDisplayName.length > 20 ? `${opts.memberDisplayName.slice(0, 20)}…` : opts.memberDisplayName;

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "600 34px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("MOTUS", 72, 95);
  ctx.font = "300 30px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(opts.eyebrow, 72, 145);
  ctx.font = "bold 76px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(displayName, 72, 255);
  ctx.font = "26px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.globalAlpha = 0.88;
  ctx.fillText(opts.subtitle, 72, 318);
  ctx.globalAlpha = 1;

  if (logo && logo.naturalWidth > 0) {
    const maxW = 292;
    const lw = maxW;
    const lh = (logo.naturalHeight / logo.naturalWidth) * lw;
    const lx = width - 56 - lw;
    const ly = 56;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.globalAlpha = 0.98;
    ctx.drawImage(logo, 0, 0, lw, lh);
    ctx.restore();
  }
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export async function shareMotusPngBlob(
  blob: Blob,
  fileName: string,
  shareTitle: string,
  shareText: string,
): Promise<MotusShareOutcome> {
  if (typeof window === "undefined") return "failed";

  try {
    const file = new File([blob], fileName, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    const canShareFile = typeof nav.canShare === "function" ? nav.canShare({ files: [file] }) : false;
    if (typeof nav.share === "function" && canShareFile) {
      await nav.share({ title: shareTitle, text: shareText, files: [file] });
      return "shared";
    }

    const imageUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(imageUrl);
    return "downloaded";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    return "failed";
  }
}

export function motusShareStatusMessage(outcome: MotusShareOutcome): string {
  switch (outcome) {
    case "shared":
      return "Kort delt. Velg Facebook eller en annen app i delingsmenyen.";
    case "downloaded":
      return "Bilde lastet ned. Last det opp på Facebook fra galleriet.";
    case "cancelled":
      return "Deling ble avbrutt.";
    default:
      return "Kunne ikke dele akkurat nå.";
  }
}

export type BadgeShareCardInput = {
  logoSrc: string;
  memberDisplayName: string;
  badgeImageSrc: string;
  badgeTitle: string;
  badgeDescription: string;
  levelName: string;
  categoryTitle: string;
  accentColor: string;
};

export async function buildBadgeShareCardBlob(input: BadgeShareCardInput): Promise<Blob | null> {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const [logo, badgeImage] = await Promise.all([loadImage(input.logoSrc), loadImage(input.badgeImageSrc)]);

  paintMotusShareBackground(ctx, canvas.width, canvas.height);
  paintMotusShareHeader(
    ctx,
    canvas.width,
    {
      eyebrow: "Badge låst opp",
      title: input.badgeTitle,
      memberDisplayName: input.memberDisplayName,
      subtitle: `${input.categoryTitle} · ${input.levelName}`,
    },
    logo,
  );

  const cardX = 56;
  const cardY = 420;
  const cardW = canvas.width - 112;
  const cardH = 1450;
  const pad = 52;

  ctx.shadowColor = "rgba(15, 23, 42, 0.22)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 28;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  fillRoundRect(ctx, cardX, cardY, cardW, cardH, 40);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const imageBox = cardW - pad * 2;
  const imageY = cardY + pad + 24;
  ctx.fillStyle = "#f8fafc";
  fillRoundRect(ctx, cardX + pad, imageY, imageBox, imageBox, 28);
  if (badgeImage && badgeImage.naturalWidth > 0) {
    const inset = 72;
    const drawSize = imageBox - inset * 2;
    const drawX = cardX + pad + inset;
    const drawY = imageY + inset;
    drawBadgeImageOnCanvas(ctx, badgeImage, drawX, drawY, drawSize, drawSize);
  }

  let y = imageY + imageBox + 48;
  ctx.fillStyle = input.accentColor;
  ctx.font = "bold 28px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(input.levelName.toUpperCase(), cardX + pad, y);
  y += 44;
  ctx.fillStyle = MOTUS.ink;
  ctx.font = "bold 52px system-ui, -apple-system, Segoe UI, sans-serif";
  fillWrappedCanvasText(ctx, input.badgeTitle, cardX + pad, y, cardW - pad * 2, 58);
  y += 120;
  ctx.fillStyle = "#475569";
  ctx.font = "28px system-ui, -apple-system, Segoe UI, sans-serif";
  fillWrappedCanvasText(ctx, input.badgeDescription, cardX + pad, y, cardW - pad * 2, 38);
  y += 160;

  const stripGrad = ctx.createLinearGradient(cardX + pad, y, cardX + cardW - pad, y + 112);
  stripGrad.addColorStop(0, MOTUS.turquoise);
  stripGrad.addColorStop(1, MOTUS.pink);
  ctx.fillStyle = stripGrad;
  fillRoundRect(ctx, cardX + pad, y, cardW - pad * 2, 112, 22);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px system-ui, -apple-system, Segoe UI, sans-serif";
  fillWrappedCanvasText(
    ctx,
    `Jeg låste opp «${input.badgeTitle}» (${input.levelName}) i Motus.`,
    cardX + pad + 32,
    y + 56,
    cardW - pad * 2 - 64,
    34,
  );

  return canvasToPngBlob(canvas);
}

export async function shareBadgeCard(input: BadgeShareCardInput): Promise<MotusShareOutcome> {
  const blob = await buildBadgeShareCardBlob(input);
  if (!blob) return "failed";
  const slug = input.badgeTitle.toLowerCase().replace(/[^a-z0-9æøå]+/gi, "-").replace(/^-|-$/g, "");
  return shareMotusPngBlob(
    blob,
    `motus-badge-${slug || "badge"}.png`,
    "Min Motus-badge",
    `Jeg låste opp ${input.badgeTitle} (${input.levelName}) i Motus #Motus`,
  );
}

export type PersonalRecordShareCardInput = {
  logoSrc: string;
  memberDisplayName: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  estimated1RmKg?: number;
  previousEstimated1RmKg?: number;
};

export async function buildPersonalRecordShareCardBlob(input: PersonalRecordShareCardInput): Promise<Blob | null> {
  if (typeof document === "undefined") return null;

  const estimated =
    input.estimated1RmKg && input.estimated1RmKg > 0
      ? input.estimated1RmKg
      : estimate1RmKg(input.weightKg, input.reps);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const logo = await loadImage(input.logoSrc);

  paintMotusShareBackground(ctx, canvas.width, canvas.height);
  paintMotusShareHeader(
    ctx,
    canvas.width,
    {
      eyebrow: "Personlig rekord",
      title: input.exerciseName,
      memberDisplayName: input.memberDisplayName,
      subtitle: "Ny styrkerekord i Motus",
    },
    logo,
  );

  const cardX = 56;
  const cardY = 420;
  const cardW = canvas.width - 112;
  const cardH = 1450;
  const pad = 52;

  ctx.shadowColor = "rgba(15, 23, 42, 0.22)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 28;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  fillRoundRect(ctx, cardX, cardY, cardW, cardH, 40);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  let y = cardY + pad + 48;
  ctx.fillStyle = "#059669";
  ctx.font = "bold 30px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("NY PERSONLIG REKORD", cardX + pad, y);
  y += 56;
  ctx.fillStyle = MOTUS.ink;
  ctx.font = "bold 56px system-ui, -apple-system, Segoe UI, sans-serif";
  fillWrappedCanvasText(ctx, input.exerciseName, cardX + pad, y, cardW - pad * 2, 62);
  y += 140;

  const statBoxH = 220;
  ctx.fillStyle = "#ecfdf5";
  fillRoundRect(ctx, cardX + pad, y, cardW - pad * 2, statBoxH, 24);
  ctx.fillStyle = "#047857";
  ctx.font = "22px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("Beste sett", cardX + pad + 28, y + 52);
  ctx.fillStyle = MOTUS.ink;
  ctx.font = "bold 64px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(`${input.weightKg} kg × ${input.reps}`, cardX + pad + 28, y + 132);
  ctx.fillStyle = "#475569";
  ctx.font = "26px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(`Estimert 1RM: ${estimated.toFixed(1)} kg`, cardX + pad + 28, y + 188);
  y += statBoxH + 36;

  if (input.previousEstimated1RmKg && input.previousEstimated1RmKg > 0 && input.previousEstimated1RmKg < estimated) {
    ctx.fillStyle = "#f8fafc";
    fillRoundRect(ctx, cardX + pad, y, cardW - pad * 2, 160, 22);
    ctx.fillStyle = "#64748b";
    ctx.font = "24px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("Fra tidligere beste estimat", cardX + pad + 28, y + 52);
    ctx.fillStyle = MOTUS.ink;
    ctx.font = "bold 40px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(
      `${input.previousEstimated1RmKg.toFixed(1)} kg  →  ${estimated.toFixed(1)} kg`,
      cardX + pad + 28,
      y + 108,
    );
    y += 188;
  }

  const stripGrad = ctx.createLinearGradient(cardX + pad, y, cardX + cardW - pad, y + 112);
  stripGrad.addColorStop(0, MOTUS.turquoise);
  stripGrad.addColorStop(1, MOTUS.pink);
  ctx.fillStyle = stripGrad;
  fillRoundRect(ctx, cardX + pad, y, cardW - pad * 2, 112, 22);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px system-ui, -apple-system, Segoe UI, sans-serif";
  fillWrappedCanvasText(
    ctx,
    `Sterkere enn før i ${input.exerciseName}!`,
    cardX + pad + 32,
    y + 56,
    cardW - pad * 2 - 64,
    34,
  );

  ctx.fillStyle = "#94a3b8";
  ctx.font = "22px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("motus · del styrken din #Motus", cardX + pad, cardY + cardH - pad);

  return canvasToPngBlob(canvas);
}

export async function sharePersonalRecordCard(input: PersonalRecordShareCardInput): Promise<MotusShareOutcome> {
  const blob = await buildPersonalRecordShareCardBlob(input);
  if (!blob) return "failed";
  const slug = input.exerciseName.toLowerCase().replace(/[^a-z0-9æøå]+/gi, "-").replace(/^-|-$/g, "");
  return shareMotusPngBlob(
    blob,
    `motus-rekord-${slug || "pr"}.png`,
    "Min Motus-rekord",
    `Ny personlig rekord i ${input.exerciseName} – ${input.weightKg} kg × ${input.reps} #Motus`,
  );
}

import { MOTUS } from "./data";
import motusSkrytekortLogo from "../assets/motus-skrytekort-logo.png";
import { buildProgressLiftPlayfulLine, computeShareCardLast7DaysStats } from "./memberProgressShareStats";

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

function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }
}

export async function shareMemberProgressWeeklySummary(input: {
  completedLogs: Parameters<typeof computeShareCardLast7DaysStats>[0];
  nowTimestamp: number;
  memberDisplayName: string;
}): Promise<string> {
  if (typeof window === "undefined") return "Deling er ikke tilgjengelig her.";

  const progressShareLast7Days = computeShareCardLast7DaysStats(input.completedLogs, input.nowTimestamp);
  const progressLiftPlayfulLine = buildProgressLiftPlayfulLine(progressShareLast7Days);
  const shareLogoSrc = `${motusSkrytekortLogo}${motusSkrytekortLogo.includes("?") ? "&" : "?"}motus_skrytekort=2026-02`;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const context = canvas.getContext("2d");
    if (!context) return "Kunne ikke lage bilde akkurat nå.";

    let shareCardLogo: HTMLImageElement | null = null;
    try {
      shareCardLogo = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error("logo"));
        im.src = shareLogoSrc;
      });
    } catch {
      shareCardLogo = null;
    }

    const displayName =
      input.memberDisplayName.length > 20 ? `${input.memberDisplayName.slice(0, 20)}…` : input.memberDisplayName;

    const bg = context.createLinearGradient(0, 0, canvas.width, canvas.height * 1.05);
    bg.addColorStop(0, "#30E3BE");
    bg.addColorStop(0.35, MOTUS.turquoise);
    bg.addColorStop(0.72, MOTUS.pink);
    bg.addColorStop(1, "#831843");
    context.fillStyle = bg;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const headerH = 380;
    context.fillStyle = "rgba(15,23,42,0.28)";
    context.fillRect(0, 0, canvas.width, headerH);
    context.fillStyle = "rgba(255,255,255,0.92)";
    context.font = "600 34px system-ui, -apple-system, Segoe UI, sans-serif";
    context.fillText("MOTUS", 72, 95);
    context.font = "300 30px system-ui, -apple-system, Segoe UI, sans-serif";
    context.fillText("Siste 7 dager", 72, 145);
    context.font = "bold 76px system-ui, -apple-system, Segoe UI, sans-serif";
    context.fillText(displayName, 72, 255);

    if (shareCardLogo && shareCardLogo.naturalWidth > 0) {
      const lw = 292;
      const lh = (shareCardLogo.naturalHeight / shareCardLogo.naturalWidth) * lw;
      context.drawImage(shareCardLogo, canvas.width - 56 - lw, 56, lw, lh);
    }

    const cardX = 56;
    const cardY = 420;
    const cardW = canvas.width - 112;
    const cardH = 1450;
    context.fillStyle = "rgba(255,255,255,0.96)";
    fillRoundRect(context, cardX, cardY, cardW, cardH, 40);

    const pad = 52;
    let y = cardY + pad + 36;
    context.fillStyle = MOTUS.ink;
    context.font = "bold 40px system-ui, -apple-system, Segoe UI, sans-serif";
    context.fillText("Mine tall · siste 7 dager", cardX + pad, y);
    y += 124;

    const tileGap = 22;
    const tileW = (cardW - pad * 2 - tileGap) / 2;
    const tileH = 168;
    const stats = [
      { label: "Mine økter", value: String(progressShareLast7Days.workouts), accent: MOTUS.turquoise },
      { label: "Mine treningsdager", value: String(progressShareLast7Days.trainingDays), accent: MOTUS.pink },
      { label: "Mine sett", value: String(progressShareLast7Days.completedSets), accent: "#30E3BE" },
      { label: "Mitt volum", value: `${Math.round(progressShareLast7Days.volumeKg).toLocaleString("nb-NO")} kg`, accent: "#db2777" },
    ];
    stats.forEach((stat, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const tx = cardX + pad + col * (tileW + tileGap);
      const ty = y + row * (tileH + tileGap);
      context.fillStyle = "#f8fafc";
      fillRoundRect(context, tx, ty, tileW, tileH, 22);
      context.fillStyle = stat.accent;
      context.fillRect(tx, ty, 6, tileH);
      context.fillStyle = "#94a3b8";
      context.font = "22px system-ui, -apple-system, Segoe UI, sans-serif";
      context.fillText(stat.label, tx + 28, ty + 48);
      context.fillStyle = MOTUS.ink;
      context.font = "bold 48px system-ui, -apple-system, Segoe UI, sans-serif";
      context.fillText(stat.value, tx + 28, ty + 118);
    });
    y += 2 * (tileH + tileGap) + 28;

    context.fillStyle = "#f8fafc";
    fillRoundRect(context, cardX + pad, y, cardW - pad * 2, 152, 22);
    context.fillStyle = MOTUS.ink;
    context.font = "bold 24px system-ui, -apple-system, Segoe UI, sans-serif";
    context.fillText("Løftefakta", cardX + pad + 24, y + 42);
    context.fillStyle = "#475569";
    context.font = "24px system-ui, -apple-system, Segoe UI, sans-serif";
    fillWrappedCanvasText(context, progressLiftPlayfulLine, cardX + pad + 24, y + 78, cardW - pad * 2 - 48, 30);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return "Kunne ikke lage bilde akkurat nå.";

    const file = new File([blob], "motus-skrytekort-siste-7-dager.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    const canShareFile = typeof nav.canShare === "function" ? nav.canShare({ files: [file] }) : false;
    if (typeof nav.share === "function" && canShareFile) {
      await nav.share({
        title: "Min Motus-oppsummering",
        text: "Siste 7 dager - se tallene mine #Motus",
        files: [file],
      });
      return "Kort delt.";
    }

    const imageUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "motus-skrytekort-siste-7-dager.png";
    link.click();
    URL.revokeObjectURL(imageUrl);
    return "Bilde lastet ned. Del det fra galleriet.";
  } catch {
    return "Deling ble avbrutt.";
  }
}

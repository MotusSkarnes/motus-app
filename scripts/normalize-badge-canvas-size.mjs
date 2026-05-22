/**
 * Normaliserer alle badge-ikoner til 1024×1024 med samme visuelle størrelse (trim + sentrert skalering).
 * Kjør: node ./scripts/normalize-badge-canvas-size.mjs [fil …]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const badgesDir = path.join(root, "public", "badges");

const CANVAS = 1024;
/** Maks innholdsstørrelse på canvas — matcher visuell vekt for tungvekter. */
const CONTENT_MAX = 880;

const DEFAULT_FILES = [
  "01-forste-steg.png",
  "02-oktjeger.png",
  "04-kveldsskiftet.png",
  "07-vanebygger.png",
  "08-streak.png",
  "11-tungvekter.png",
  "13-konsistent.png",
  "30-mandagshelt.png",
  "33-pulsmaskin.png",
  "32-100-klubben.svg",
  "34-200-klubben.png",
  "31-helgekriger.svg",
  "21-17-mai.svg",
  "22-aldri-to-uker-uten.svg",
  "23-tilbake-igjen.svg",
  "24-vanen-sitter.svg",
  "25-for-sola.svg",
  "26-sommertrofast.svg",
  "27-ny-start.svg",
  "28-paskepump.svg",
  "29-julepump.svg",
];

async function normalizeBadgeAsset(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const isSvg = ext === ".svg";
  const outPath = isSvg ? filePath.replace(/\.svg$/i, ".png") : filePath;

  let pipeline = sharp(filePath, isSvg ? { density: 300 } : undefined).ensureAlpha();
  const trimmed = await pipeline.trim().png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const width = meta.width ?? CANVAS;
  const height = meta.height ?? CANVAS;
  const scale = CONTENT_MAX / Math.max(width, height, 1);
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const resized = await sharp(trimmed).resize(targetW, targetH, { fit: "inside" }).png().toBuffer();

  const tmpPath = `${outPath}.tmp`;
  await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(tmpPath);

  await fs.promises.rename(tmpPath, outPath);
  console.log("normalized", path.basename(outPath), isSvg ? `(from ${path.basename(filePath)})` : "");
}

const args = process.argv.slice(2);
const files =
  args.length > 0
    ? args.map((name) => path.join(badgesDir, name))
    : DEFAULT_FILES.map((name) => path.join(badgesDir, name));

for (const filePath of files) {
  if (!fs.existsSync(filePath)) {
    console.warn("skip missing", path.basename(filePath));
    continue;
  }
  await normalizeBadgeAsset(filePath);
}

console.log(`Done. Canvas ${CANVAS}px, content max ${CONTENT_MAX}px.`);

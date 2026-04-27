/**
 * Generates fixed-size PNGs for PWA / Lighthouse (192, 512, maskable 512, apple-touch 180).
 * Source: src/assets/motus-logo.png → public/
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const logoPath = path.join(root, "src", "assets", "motus-logo.png");
const publicDir = path.join(root, "public");

const white = { r: 255, g: 255, b: 255, alpha: 1 };

async function squareContain(size, outName) {
  const dest = path.join(publicDir, outName);
  await sharp(logoPath)
    .resize(size, size, { fit: "contain", background: white })
    .png()
    .toFile(dest);
  console.log("Wrote", outName);
}

/** ~80% safe zone for adaptive icons (maskable). */
async function maskable512(outName) {
  const canvas = 512;
  const inner = Math.round(canvas * 0.8);
  const innerBuf = await sharp(logoPath)
    .resize(inner, inner, { fit: "contain", background: white })
    .png()
    .toBuffer();
  const meta = await sharp(innerBuf).metadata();
  const w = meta.width ?? inner;
  const h = meta.height ?? inner;
  const left = Math.round((canvas - w) / 2);
  const top = Math.round((canvas - h) / 2);

  await sharp({
    create: { width: canvas, height: canvas, channels: 4, background: white },
  })
    .composite([{ input: innerBuf, left, top }])
    .png()
    .toFile(path.join(publicDir, outName));
  console.log("Wrote", outName);
}

async function main() {
  await squareContain(192, "pwa-192.png");
  await squareContain(512, "pwa-512.png");
  await maskable512("pwa-512-maskable.png");
  await squareContain(180, "apple-touch-icon.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

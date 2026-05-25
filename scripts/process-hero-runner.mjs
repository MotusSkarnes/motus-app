/**
 * Convert the AI-generated runner photo to a clean webp with transparent
 * background, ready for the Inspirasjon hero.
 *
 * - Trims excess background
 * - Replaces near-white background with alpha
 * - Resizes to a reasonable hero size
 */
import path from "node:path";
import sharp from "sharp";

const inputPath = path.resolve(
  "C:/Users/lener/.cursor/projects/c-Users-lener-OneDrive-Lene-motus-pt-app/assets/inspo-hero-runner-source.png",
);
const outputPath = path.resolve("src/assets/inspo-hero-runner.webp");

const trimmed = await sharp(inputPath)
  .trim({ background: { r: 255, g: 255, b: 255 }, threshold: 8 })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { data, info } = trimmed;
const { width, height, channels } = info;
if (channels < 4) throw new Error("Expected 4 channel RGBA buffer");

const out = Buffer.from(data);
// Pixels whose minimum channel >= whiteFloor are fully transparent;
// pixels in the soft band (whiteFloor - feather) get partial alpha for smooth edges.
const whiteFloor = 240;
const feather = 14;
let cleared = 0;
let softened = 0;
for (let i = 0; i < out.length; i += 4) {
  const r = out[i];
  const g = out[i + 1];
  const b = out[i + 2];
  const minChannel = Math.min(r, g, b);
  if (minChannel >= whiteFloor) {
    out[i + 3] = 0;
    cleared++;
  } else if (minChannel >= whiteFloor - feather) {
    const t = (whiteFloor - minChannel) / feather;
    out[i + 3] = Math.round(out[i + 3] * t);
    softened++;
  }
}

await sharp(out, { raw: { width, height, channels: 4 } })
  .resize({ width: 720, withoutEnlargement: true })
  .webp({ quality: 90, alphaQuality: 92, effort: 6 })
  .toFile(outputPath);

console.log(`wrote ${outputPath} (${width}x${height} -> resized to 720w webp)`);
console.log(`cleared=${cleared} softened=${softened}`);

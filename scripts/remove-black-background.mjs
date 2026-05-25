/**
 * Remove (near-)black background from an input PNG and write a PNG with alpha.
 * Usage: node scripts/remove-black-background.mjs <input.png> <output.png> [threshold]
 *  - threshold (0-255), default 32. Pixels whose max(R,G,B) <= threshold become fully transparent.
 *  - A small feather is applied near the threshold for smoother edges.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [, , inputArg, outputArg, thresholdArg] = process.argv;
if (!inputArg || !outputArg) {
  console.error("Usage: node remove-black-background.mjs <input.png> <output.png> [threshold]");
  process.exit(1);
}

const threshold = Math.max(0, Math.min(255, Number(thresholdArg ?? 32)));
const featherRange = 24; // soft edge above threshold

const inputPath = path.resolve(inputArg);
const outputPath = path.resolve(outputArg);

const image = sharp(inputPath).ensureAlpha();
const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
if (channels < 4) throw new Error("Expected 4 channel RGBA buffer");

const out = Buffer.from(data);
let cleared = 0;
let softened = 0;
for (let i = 0; i < out.length; i += 4) {
  const r = out[i];
  const g = out[i + 1];
  const b = out[i + 2];
  const luminance = Math.max(r, g, b);
  if (luminance <= threshold) {
    out[i + 3] = 0;
    cleared++;
  } else if (luminance <= threshold + featherRange) {
    const t = (luminance - threshold) / featherRange;
    out[i + 3] = Math.round(out[i + 3] * t);
    softened++;
  }
}

await sharp(out, { raw: { width, height, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

const inputSize = (await fs.stat(inputPath)).size;
const outputSize = (await fs.stat(outputPath)).size;
console.log(
  `wrote ${outputPath} (${width}x${height}) — cleared=${cleared} softened=${softened} input=${inputSize}B output=${outputSize}B`,
);

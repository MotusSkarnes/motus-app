/**
 * Makes motus-mark-brush.png use real alpha by clearing near-black background pixels.
 * Run: node ./scripts/transparentize-motus-mark.mjs
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcPath = path.join(root, "src", "assets", "motus-mark-brush.png");

const threshold = 42; // treat very dark pixels as background

async function main() {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) {
    console.error("Expected RGBA image, got channels:", channels);
    process.exit(1);
  }
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r <= threshold && g <= threshold && b <= threshold) {
      data[i + 3] = 0;
    }
  }
  const tmp = path.join(os.tmpdir(), `motus-mark-brush-${Date.now()}.png`);
  await sharp(data, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(tmp);
  await fs.copyFile(tmp, srcPath);
  await fs.unlink(tmp);
  console.log("Wrote transparent background:", path.relative(root, srcPath));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

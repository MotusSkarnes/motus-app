/**
 * Fjerner kun svart AI-bakgrunn koblet til bildets kanter.
 * Bevarer hvit hex-ramme og lyst innhold (f.eks. Pinsetrener, Morgenfugl).
 *
 * Kjør: node ./scripts/strip-badge-black-edge-only.mjs [fil …]
 * Deretter: node ./scripts/normalize-badge-canvas-size.mjs [fil …]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const badgesDir = path.join(__dirname, "..", "public", "badges");

const BLACK_THRESHOLD = 32;

function isNearBlack(r, g, b) {
  return r <= BLACK_THRESHOLD && g <= BLACK_THRESHOLD && b <= BLACK_THRESHOLD;
}

function floodFillEdgeBlack(data, width, height, channels) {
  const size = width * height;
  const visited = new Uint8Array(size);
  const queue = [];

  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const o = idx * channels;
    if (!isNearBlack(data[o], data[o + 1], data[o + 2])) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  let head = 0;
  let changed = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const o = idx * channels;
    if (data[o + 3] > 0) {
      data[o + 3] = 0;
      changed += 1;
    }
    const x = idx % width;
    const y = Math.floor(idx / width);
    tryPush(x - 1, y);
    tryPush(x + 1, y);
    tryPush(x, y - 1);
    tryPush(x, y + 1);
  }

  return changed;
}

async function stripBlackEdgeOnly(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const changed = floodFillEdgeBlack(data, width, height, channels);
  if (changed === 0) {
    console.log("unchanged", path.basename(filePath));
    return;
  }
  const tmpPath = `${filePath}.tmp`;
  await sharp(data, { raw: { width, height, channels } }).png().toFile(tmpPath);
  await fs.promises.rename(tmpPath, filePath);
  console.log("stripped-black-only", path.basename(filePath), `(edge ${changed} px)`);
}

const args = process.argv.slice(2);
const files =
  args.length > 0
    ? args.map((name) => path.join(badgesDir, name))
    : [];

for (const filePath of files) {
  if (!fs.existsSync(filePath)) {
    console.warn("skip missing", path.basename(filePath));
    continue;
  }
  await stripBlackEdgeOnly(filePath);
}

console.log(`Processed ${files.length} badge PNG(s).`);

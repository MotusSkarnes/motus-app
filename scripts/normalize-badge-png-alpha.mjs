/**
 * Fjerner svart bakgrunn som er koblet til kantene (flood fill), ikke svarte detaljer inni motivet.
 * Kjør: node ./scripts/normalize-badge-png-alpha.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const badgesDir = path.join(root, "public", "badges");

const BLACK_THRESHOLD = 32;

function isNearBlack(r, g, b) {
  return r <= BLACK_THRESHOLD && g <= BLACK_THRESHOLD && b <= BLACK_THRESHOLD;
}

function floodFillEdgeBackground(data, width, height, channels) {
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

async function stripEdgeBlackBackground(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const changed = floodFillEdgeBackground(data, width, height, channels);

  if (changed === 0) {
    console.log("unchanged", path.basename(filePath));
    return;
  }

  const tmpPath = `${filePath}.tmp`;
  await sharp(data, { raw: { width, height, channels } }).png().toFile(tmpPath);
  await fs.promises.rename(tmpPath, filePath);
  console.log("fixed", path.basename(filePath), `(${changed} px)`);
}

const files = fs.readdirSync(badgesDir).filter((name) => name.toLowerCase().endsWith(".png"));
for (const name of files) {
  await stripEdgeBlackBackground(path.join(badgesDir, name));
}

console.log(`Processed ${files.length} badge PNG(s) in public/badges`);

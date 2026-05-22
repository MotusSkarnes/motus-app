/**
 * Rydder badge-alpha:
 * - Fjerner svart bakgrunn som er koblet til kantene (flood fill).
 * - Fyller transparente hull inne i motivet, slik at kun ytre bakgrunn er transparent.
 *
 * Kjor: node ./scripts/normalize-badge-png-alpha.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const badgesDir = path.join(root, "public", "badges");

const BLACK_THRESHOLD = 32;
const TRANSPARENT_THRESHOLD = 8;

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

function findEdgeTransparentMask(data, width, height, channels) {
  const size = width * height;
  const edge = new Uint8Array(size);
  const queue = [];

  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (edge[idx]) return;
    const o = idx * channels;
    if (data[o + 3] > TRANSPARENT_THRESHOLD) return;
    edge[idx] = 1;
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
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % width;
    const y = Math.floor(idx / width);
    tryPush(x - 1, y);
    tryPush(x + 1, y);
    tryPush(x, y - 1);
    tryPush(x, y + 1);
  }

  return edge;
}

function fillEnclosedTransparentHoles(data, width, height, channels) {
  const size = width * height;
  const edgeTransparent = findEdgeTransparentMask(data, width, height, channels);
  const pending = new Uint8Array(size);
  let pendingCount = 0;

  for (let idx = 0; idx < size; idx += 1) {
    const o = idx * channels;
    if (data[o + 3] <= TRANSPARENT_THRESHOLD && !edgeTransparent[idx]) {
      pending[idx] = 1;
      pendingCount += 1;
    }
  }

  if (pendingCount === 0) return 0;

  const offsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];

  let changed = 0;
  while (pendingCount > 0) {
    const updates = [];

    for (let idx = 0; idx < size; idx += 1) {
      if (!pending[idx]) continue;
      const x = idx % width;
      const y = Math.floor(idx / width);
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (const [dx, dy] of offsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (pending[ni]) continue;
        const no = ni * channels;
        if (data[no + 3] <= TRANSPARENT_THRESHOLD) continue;
        r += data[no];
        g += data[no + 1];
        b += data[no + 2];
        count += 1;
      }

      if (count > 0) {
        updates.push([idx, Math.round(r / count), Math.round(g / count), Math.round(b / count)]);
      }
    }

    if (updates.length === 0) break;

    for (const [idx, r, g, b] of updates) {
      const o = idx * channels;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
      pending[idx] = 0;
      pendingCount -= 1;
      changed += 1;
    }
  }

  return changed;
}

async function normalizeBadgeAlpha(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const edgeChanged = floodFillEdgeBackground(data, width, height, channels);
  const holeChanged = fillEnclosedTransparentHoles(data, width, height, channels);
  const changed = edgeChanged + holeChanged;

  if (changed === 0) {
    console.log("unchanged", path.basename(filePath));
    return;
  }

  const tmpPath = `${filePath}.tmp`;
  await sharp(data, { raw: { width, height, channels } }).png().toFile(tmpPath);
  await fs.promises.rename(tmpPath, filePath);
  console.log("fixed", path.basename(filePath), `(edge ${edgeChanged} px, holes ${holeChanged} px)`);
}

const args = process.argv.slice(2);
const files =
  args.length > 0
    ? args.map((name) => path.join(badgesDir, name))
    : fs.readdirSync(badgesDir).filter((name) => name.toLowerCase().endsWith(".png"));
for (const filePath of files) {
  if (!fs.existsSync(filePath)) {
    console.warn("skip missing", path.basename(filePath));
    continue;
  }
  await normalizeBadgeAlpha(filePath);
}

console.log(`Processed ${files.length} badge PNG(s) in public/badges`);

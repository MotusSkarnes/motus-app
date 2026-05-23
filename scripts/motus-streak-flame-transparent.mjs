/**
 * Removes the baked-in white background from public/icons/motus-streak-flame.png.
 * Uses edge flood-fill so light flame highlights are preserved.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(__dirname, "..", "public", "icons", "motus-streak-flame.png");
const tmp = `${input}.tmp`;

const isBackground = (r, g, b) =>
  r >= 250 && g >= 250 && b >= 250 && Math.max(r, g, b) - Math.min(r, g, b) <= 8;

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const out = Buffer.from(data);
const visited = new Uint8Array(width * height);
const queue = [];

const tryPush = (x, y) => {
  const idx = y * width + x;
  if (visited[idx]) return;
  const i = idx * 4;
  if (!isBackground(out[i], out[i + 1], out[i + 2])) return;
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

while (queue.length > 0) {
  const idx = queue.pop();
  const x = idx % width;
  const y = Math.floor(idx / width);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    tryPush(nx, ny);
  }
}

let removed = 0;
for (let idx = 0; idx < width * height; idx += 1) {
  if (!visited[idx]) continue;
  out[idx * 4 + 3] = 0;
  removed += 1;
}

await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(tmp);
fs.renameSync(tmp, input);
console.log(`motus-streak-flame: removed ${removed}/${width * height} background pixels`);

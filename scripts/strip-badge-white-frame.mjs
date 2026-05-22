/**
 * Gjør badge-ikoner «rammeløse» som Tungvekter: transparent bakgrunn uten hvit hex-plate.
 * 1) Flood fra kant gjennom transparent/nesten hvitt
 * 2) Fjern hvite flater som ikke ligger inntil mettede motivpiksler (bevarer f.eks. «100» på kettlebell)
 * Kjør: node ./scripts/strip-badge-white-frame.mjs [fil …]
 * Deretter: node ./scripts/normalize-badge-canvas-size.mjs [fil …]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const badgesDir = path.join(__dirname, "..", "public", "badges");

const EDGE_WHITE_THRESHOLD = 238;
/** Hvit plate inni hex — lavere terskel + metningskrav. */
const PLATE_MAX_SATURATION = 0.14;
const PLATE_MIN_LIGHTNESS = 0.82;
/** Motiv = mettet nok til å telle som «innhold». */
const SUBJECT_MIN_SATURATION = 0.17;
const SUBJECT_MAX_LIGHTNESS = 0.42;
const SUBJECT_PROTECT_RADIUS = 6;
const CROP_PADDING_RATIO = 0.04;
/** Ytre sone der hex-ramme ligger — ekskluderes fra utsnitt. */
const FRAME_EXCLUDE_MARGIN_RATIO = 0.2;

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function isEdgeRemovable(r, g, b, a) {
  if (a < 15) return true;
  return r >= EDGE_WHITE_THRESHOLD && g >= EDGE_WHITE_THRESHOLD && b >= EDGE_WHITE_THRESHOLD;
}

function isPlateWhite(r, g, b, a) {
  if (a < 15) return false;
  const { s, l } = rgbToHsl(r, g, b);
  return s <= PLATE_MAX_SATURATION && l >= PLATE_MIN_LIGHTNESS;
}

function floodStripEdgePadding(data, width, height, channels) {
  const size = width * height;
  const visited = new Uint8Array(size);
  const queue = [];

  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const o = idx * channels;
    if (!isEdgeRemovable(data[o], data[o + 1], data[o + 2], data[o + 3])) return;
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

  let changed = 0;
  let head = 0;
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

function stripInteriorWhitePlate(data, width, height, channels) {
  const size = width * height;
  const subject = new Uint8Array(size);
  const protect = new Uint8Array(size);

  for (let idx = 0; idx < size; idx += 1) {
    const o = idx * channels;
    if (data[o + 3] < 15) continue;
    const { s } = rgbToHsl(data[o], data[o + 1], data[o + 2]);
    if (s >= SUBJECT_MIN_SATURATION) subject[idx] = 1;
  }

  for (let idx = 0; idx < size; idx += 1) {
    if (!subject[idx]) continue;
    const x = idx % width;
    const y = Math.floor(idx / width);
    for (let dy = -SUBJECT_PROTECT_RADIUS; dy <= SUBJECT_PROTECT_RADIUS; dy += 1) {
      for (let dx = -SUBJECT_PROTECT_RADIUS; dx <= SUBJECT_PROTECT_RADIUS; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        protect[ny * width + nx] = 1;
      }
    }
  }

  let changed = 0;
  for (let idx = 0; idx < size; idx += 1) {
    const o = idx * channels;
    if (data[o + 3] < 15) continue;
    if (protect[idx]) continue;
    if (!isPlateWhite(data[o], data[o + 1], data[o + 2], data[o + 3])) continue;
    data[o + 3] = 0;
    changed += 1;
  }

  return changed;
}

/** Fjerner hvite rester som ikke ligger inntil mørk/mettet motiv. */
function cleanupStrayWhite(data, width, height, channels) {
  const size = width * height;
  let changed = 0;

  for (let idx = 0; idx < size; idx += 1) {
    const o = idx * channels;
    if (!isPlateWhite(data[o], data[o + 1], data[o + 2], data[o + 3])) continue;
    const x = idx % width;
    const y = Math.floor(idx / width);
    let nearSubject = false;

    for (let dy = -3; dy <= 3 && !nearSubject; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = (ny * width + nx) * channels;
        if (data[ni + 3] < 20) continue;
        const { s, l } = rgbToHsl(data[ni], data[ni + 1], data[ni + 2]);
        if (s >= SUBJECT_MIN_SATURATION || l <= SUBJECT_MAX_LIGHTNESS) {
          nearSubject = true;
          break;
        }
      }
    }

    if (nearSubject) continue;
    data[o + 3] = 0;
    changed += 1;
  }

  return changed;
}

function isSubjectCore(r, g, b, a) {
  if (a < 20) return false;
  const { s, l } = rgbToHsl(r, g, b);
  return s >= SUBJECT_MIN_SATURATION || l <= SUBJECT_MAX_LIGHTNESS;
}

function cropToSubject(data, width, height, channels) {
  const size = width * height;
  const subject = new Uint8Array(size);

  const marginX = Math.round(width * FRAME_EXCLUDE_MARGIN_RATIO);
  const marginY = Math.round(height * FRAME_EXCLUDE_MARGIN_RATIO);

  for (let idx = 0; idx < size; idx += 1) {
    const o = idx * channels;
    if (!isSubjectCore(data[o], data[o + 1], data[o + 2], data[o + 3])) continue;
    const x = idx % width;
    const y = Math.floor(idx / width);
    if (x < marginX || x >= width - marginX || y < marginY || y >= height - marginY) continue;
    for (let dy = -SUBJECT_PROTECT_RADIUS; dy <= SUBJECT_PROTECT_RADIUS; dy += 1) {
      for (let dx = -SUBJECT_PROTECT_RADIUS; dx <= SUBJECT_PROTECT_RADIUS; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        subject[ny * width + nx] = 1;
      }
    }
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!subject[y * width + x]) continue;
      found = true;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (!found) return { data, width, height, cropped: false };

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const padX = Math.round(cropW * CROP_PADDING_RATIO);
  const padY = Math.round(cropH * CROP_PADDING_RATIO);
  const left = Math.max(0, minX - padX);
  const top = Math.max(0, minY - padY);
  const right = Math.min(width, maxX + 1 + padX);
  const bottom = Math.min(height, maxY + 1 + padY);
  const outW = right - left;
  const outH = bottom - top;
  const out = Buffer.alloc(outW * outH * channels);

  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const src = ((top + y) * width + (left + x)) * channels;
      const dst = (y * outW + x) * channels;
      for (let c = 0; c < channels; c += 1) out[dst + c] = data[src + c];
    }
  }

  return { data: out, width: outW, height: outH, cropped: true };
}

export async function stripBadgeWhiteFrame(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const edgeChanged = floodStripEdgePadding(data, width, height, channels);
  const plateChanged = stripInteriorWhitePlate(data, width, height, channels);
  const strayChanged = cleanupStrayWhite(data, width, height, channels);
  const cropped = cropToSubject(data, width, height, channels);
  const out = cropped.cropped ? cropped : { data, width, height };
  const changed = edgeChanged + plateChanged + strayChanged + (cropped.cropped ? 1 : 0);

  if (changed === 0) {
    console.log("unchanged", path.basename(filePath));
    return false;
  }

  const tmpPath = `${filePath}.tmp`;
  await sharp(out.data, { raw: { width: out.width, height: out.height, channels } }).png().toFile(tmpPath);
  await fs.promises.rename(tmpPath, filePath);
  console.log(
    "stripped",
    path.basename(filePath),
    `(edge ${edgeChanged}, plate ${plateChanged}, stray ${strayChanged}${cropped.cropped ? ", cropped" : ""})`,
  );
  return true;
}

const args = process.argv.slice(2);
const files =
  args.length > 0
    ? args.map((name) => path.join(badgesDir, name))
    : fs.readdirSync(badgesDir).filter((name) => name.toLowerCase().endsWith(".png") && !name.startsWith("_"));

for (const filePath of files) {
  await stripBadgeWhiteFrame(filePath);
}

console.log(`Processed ${files.length} badge PNG(s).`);

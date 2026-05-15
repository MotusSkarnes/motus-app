/**
 * Builds src/assets/motus-skrytekort-logo.png from a Motus brush logo source.
 *
 * Best result: export PNG from Figma/Illustrator with transparent background,
 * white M + black "motus" (not black matte behind the wordmark).
 *
 * JPEG / black-matte sources: keeps the white M pixels exactly and removes only
 * edge-connected black background. Black "motus" on black matte cannot be recovered.
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const src =
  process.argv[2] ??
  path.join(root, "src/assets/motus-skrytekort-source.png");

const output = path.join(root, "src/assets/motus-skrytekort-logo.png");
const BACKGROUND_MAX = 12;
const WHITE_MIN = 200;

function isBackgroundBlack(r, g, b) {
  return Math.max(r, g, b) <= BACKGROUND_MAX;
}

function isWhiteMark(r, g, b) {
  return Math.max(r, g, b) >= WHITE_MIN;
}

function sampleCornersLuma(data, width, height, channels) {
  const points = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  let sum = 0;
  for (const [x, y] of points) {
    const i = (y * width + x) * channels;
    sum += Math.max(data[i], data[i + 1], data[i + 2]);
  }
  return sum / points.length;
}

async function buildFromOpaqueSource(buffer, meta) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  function pushIfBackground(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (!isBackgroundBlack(data[i], data[i + 1], data[i + 2])) return;
    visited[idx] = 1;
    queue.push(idx);
  }

  for (let x = 0; x < width; x += 1) {
    pushIfBackground(x, 0);
    pushIfBackground(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    pushIfBackground(0, y);
    pushIfBackground(width - 1, y);
  }

  while (queue.length > 0) {
    const idx = queue.pop();
    const x = idx % width;
    const y = Math.floor(idx / width);
    pushIfBackground(x - 1, y);
    pushIfBackground(x + 1, y);
    pushIfBackground(x, y - 1);
    pushIfBackground(x, y + 1);
  }

  let whiteKept = 0;
  let blackKept = 0;
  let fringeKept = 0;
  let transparent = 0;

  for (let idx = 0; idx < width * height; idx += 1) {
    const i = idx * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luminance = Math.max(r, g, b);

    if (visited[idx]) {
      data[i + 3] = 0;
      transparent += 1;
      continue;
    }

    data[i + 3] = 255;
    if (isWhiteMark(r, g, b)) {
      whiteKept += 1;
    } else if (isBackgroundBlack(r, g, b)) {
      blackKept += 1;
    } else {
      fringeKept += 1;
    }
  }

  await sharp(data, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(output);

  return { mode: "opaque-flood", whiteKept, blackKept, fringeKept, transparent };
}

async function buildFromTransparentSource(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let kept = 0;
  let whiteKept = 0;
  let blackKept = 0;
  let transparent = 0;

  for (let idx = 0; idx < width * height; idx += 1) {
    const i = idx * 4;
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const a = data[i + 3];

    if (a < 16) {
      data[i + 3] = 0;
      transparent += 1;
      continue;
    }

    if (a < 255) {
      const scale = 255 / a;
      r = Math.min(255, Math.round(r * scale));
      g = Math.min(255, Math.round(g * scale));
      b = Math.min(255, Math.round(b * scale));
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
    kept += 1;
    if (Math.max(r, g, b) >= WHITE_MIN) whiteKept += 1;
    else if (Math.max(r, g, b) <= BACKGROUND_MAX) blackKept += 1;
  }

  await sharp(data, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(output);

  return { mode: "alpha-source", kept, whiteKept, blackKept, transparent };
}

async function buildFromWhiteBackground(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let whiteKept = 0;
  let blackKept = 0;
  let fringeKept = 0;
  let transparent = 0;

  for (let idx = 0; idx < width * height; idx += 1) {
    const i = idx * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luminance = Math.max(r, g, b);

    if (luminance >= 248) {
      data[i + 3] = 0;
      transparent += 1;
      continue;
    }

    data[i + 3] = 255;
    if (isWhiteMark(r, g, b)) {
      whiteKept += 1;
    } else if (luminance <= BACKGROUND_MAX) {
      blackKept += 1;
    } else {
      fringeKept += 1;
    }
  }

  await sharp(data, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(output);

  return { mode: "white-background", whiteKept, blackKept, fringeKept, transparent };
}

const input = sharp(src);
const meta = await input.metadata();
const raw = await input.raw().toBuffer({ resolveWithObject: true });
const cornerLuma = sampleCornersLuma(raw.data, raw.info.width, raw.info.height, raw.info.channels);

let stats;
if (meta.hasAlpha) {
  stats = await buildFromTransparentSource(await sharp(src).toBuffer());
} else if (cornerLuma > 128) {
  stats = await buildFromWhiteBackground(await sharp(src).toBuffer());
} else {
  stats = await buildFromOpaqueSource(await sharp(src).toBuffer(), meta);
  if (stats.blackKept < 500) {
    console.warn(
      "Warning: source looks like black matte + white M only. Export PNG with transparent background and black \"motus\" text for the full logo.",
    );
  }
}

const outMeta = await sharp(output).metadata();
console.log({
  src,
  output,
  format: meta.format,
  width: outMeta.width,
  height: outMeta.height,
  hasAlpha: outMeta.hasAlpha,
  cornerLuma: Math.round(cornerLuma),
  ...stats,
});

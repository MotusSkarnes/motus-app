import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const src =
  process.argv[2] ??
  path.join(
    root,
    "..",
    ".cursor",
    "projects",
    "c-Users-iben-OneDrive-Lene-motus-pt-app",
    "assets",
    "c__Users_iben_AppData_Roaming_Cursor_User_workspaceStorage_b12ce805d51d929840c8009c3ccf9154_images_Motus_logo_Til_turkis_bakgrunn-5e590ff2-cb68-42ad-b5cd-9089fc3d453d.png",
  );

const outputs = [
  path.join(root, "src/assets/motus-skrytekort-logo.png"),
  path.join(root, "src/assets/motus-mark-brush-transparent.png"),
];

const BACKGROUND_MAX = 18;

function isBackgroundPixel(r, g, b) {
  return r <= BACKGROUND_MAX && g <= BACKGROUND_MAX && b <= BACKGROUND_MAX;
}

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const visited = new Uint8Array(width * height);
const queue = [];

function pushIfBackground(x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const idx = y * width + x;
  if (visited[idx]) return;
  const i = idx * 4;
  if (!isBackgroundPixel(data[i], data[i + 1], data[i + 2])) return;
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

let removed = 0;
let keptDark = 0;
for (let idx = 0; idx < width * height; idx += 1) {
  const i = idx * 4;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (visited[idx]) {
    data[i + 3] = 0;
    removed += 1;
  } else if (isBackgroundPixel(r, g, b)) {
    keptDark += 1;
  }
}

for (const out of outputs) {
  await sharp(data, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
}

const meta = await sharp(outputs[0]).metadata();
console.log({ src, width: meta.width, height: meta.height, hasAlpha: meta.hasAlpha, removed, keptDark, outputs });

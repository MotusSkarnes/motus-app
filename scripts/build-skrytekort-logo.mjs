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
    "c__Users_iben_AppData_Roaming_Cursor_User_workspaceStorage_b12ce805d51d929840c8009c3ccf9154_images_Motus_logo_Til_turkis_bakgrunn-4f517c59-140f-4c5a-adc6-195094651602.png",
  );

const output = path.join(root, "src/assets/motus-skrytekort-logo.png");
const BACKGROUND_MAX = 12;
const WHITE_MIN = 180;
const INK = "#000000";

function isBackgroundPixel(r, g, b) {
  return Math.max(r, g, b) <= BACKGROUND_MAX;
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

let minX = width;
let minY = height;
let maxX = 0;
let maxY = 0;

for (let idx = 0; idx < width * height; idx += 1) {
  const i = idx * 4;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const luminance = Math.max(r, g, b);

  if (visited[idx]) {
    data[i + 3] = 0;
    continue;
  }

  if (luminance >= WHITE_MIN) {
    data[i + 3] = 255;
    const x = idx % width;
    const y = Math.floor(idx / width);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    continue;
  }

  data[i + 3] = 0;
}

const markCenterX = (minX + maxX) / 2;
const textY = maxY + Math.max(36, Math.round((height - maxY) * 0.42));
const fontSize = Math.round(Math.max(52, Math.min(86, width * 0.078)));

const textSvg = Buffer.from(
  `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text
      x="${markCenterX.toFixed(1)}"
      y="${textY.toFixed(1)}"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="Segoe UI, system-ui, Helvetica, Arial, sans-serif"
      font-size="${fontSize}"
      font-weight="500"
      letter-spacing="0.04em"
      fill="${INK}"
    >motus</text>
  </svg>`,
);

await sharp(data, { raw: { width, height, channels: 4 } })
  .composite([{ input: textSvg, top: 0, left: 0 }])
  .png({ compressionLevel: 9 })
  .toFile(output);

const meta = await sharp(output).metadata();
console.log({
  src,
  output,
  width: meta.width,
  height: meta.height,
  hasAlpha: meta.hasAlpha,
  fontSize,
  textY,
  markBox: { minX, minY, maxX, maxY },
});

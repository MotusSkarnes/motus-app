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

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r < 28 && g < 28 && b < 28) {
    data[i + 3] = 0;
  }
}

for (const out of outputs) {
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
}

const meta = await sharp(outputs[0]).metadata();
console.log({ src, width: meta.width, height: meta.height, hasAlpha: meta.hasAlpha, outputs });

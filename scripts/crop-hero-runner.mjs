/**
 * Crop the original runner photo to upper body only, remove black background,
 * and write `src/assets/inspo-hero-runner.webp`.
 */
import path from "node:path";
import sharp from "sharp";

const inputPath = path.resolve(
  "C:/Users/lener/.cursor/projects/c-Users-lener-OneDrive-Lene-motus-pt-app/assets/c__Users_lener_AppData_Roaming_Cursor_User_workspaceStorage_0d59f408b349df889b3f4a2bea0b2429_images_ChatGPT_Image_25._mai_2026__20_54_29-b2d98dda-e035-4e85-9d7d-1a2603bdec2b.png",
);
const outputPath = path.resolve("src/assets/inspo-hero-runner.webp");

// Original is 682x1024. Upper body ends roughly at the bottom of the pink tee
// (just below where t-shirt meets tights). Keep ~52% of the height.
const meta = await sharp(inputPath).metadata();
const fullWidth = meta.width ?? 682;
const fullHeight = meta.height ?? 1024;
const cropHeight = Math.round(fullHeight * 0.55);

const cropped = await sharp(inputPath)
  .extract({ left: 0, top: 0, width: fullWidth, height: cropHeight })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { data, info } = cropped;
const { width, height, channels } = info;
const out = Buffer.from(data);
const threshold = 36;
const featherRange = 24;
for (let i = 0; i < out.length; i += 4) {
  const r = out[i];
  const g = out[i + 1];
  const b = out[i + 2];
  const luminance = Math.max(r, g, b);
  if (luminance <= threshold) {
    out[i + 3] = 0;
  } else if (luminance <= threshold + featherRange) {
    const t = (luminance - threshold) / featherRange;
    out[i + 3] = Math.round(out[i + 3] * t);
  }
}

await sharp(out, { raw: { width, height, channels: 4 } })
  .resize({ width: 720, withoutEnlargement: true })
  .webp({ quality: 88, alphaQuality: 90, effort: 6 })
  .toFile(outputPath);

console.log(`wrote ${outputPath} (${width}x${height} -> resized to ~720w webp)`);

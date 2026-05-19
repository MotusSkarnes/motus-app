/**
 * Normaliserer øvelsesillustrasjon til kvadratisk 1:1 (standard 1024×1024).
 * Krever: npm install sharp --save-dev
 *
 * Eksempel:
 *   node scripts/normalize-exercise-illustration.mjs input.png public/exercise-illustrations/rehab/e195a.png
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";

const SIZE = Number(process.env.EXERCISE_ILLUSTRATION_SIZE || 1024);
const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error("Bruk: node scripts/normalize-exercise-illustration.mjs <input> <output.png>");
  process.exit(1);
}

mkdirSync(dirname(outputPath), { recursive: true });

await sharp(inputPath)
  .resize(SIZE, SIZE, {
    fit: "contain",
    background: { r: 255, g: 255, b: 255, alpha: 1 },
    position: "centre",
  })
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Wrote ${SIZE}×${SIZE} (1:1) → ${outputPath}`);

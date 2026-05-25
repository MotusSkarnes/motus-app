import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function parseDataTs(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = [];
  const re =
    /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*group:\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(text))) {
    rows.push({ source: "data.ts", id: m[1], name: m[2], category: m[3], muscle_group: m[4] });
  }
  return rows;
}

function parseSqlSeed(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = [];
  const re =
    /\('([^']+)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(true|false)\)/g;
  let m;
  while ((m = re.exec(text))) {
    rows.push({
      source: path.basename(filePath),
      id: m[1],
      name: m[2],
      category: m[3],
      muscle_group: m[4],
    });
  }
  return rows;
}

function isUnknownGroup(value) {
  const g = String(value ?? "").trim();
  return !g || g.toLowerCase() === "ukjent";
}

const all = [
  ...parseDataTs(path.join(root, "src", "app", "data.ts")),
  ...parseSqlSeed(path.join(root, "src", "supabase", "seed_strength_exercises_no.sql")),
  ...parseSqlSeed(path.join(root, "src", "supabase", "seed_rehab_exercises.sql")),
  ...parseSqlSeed(path.join(root, "src", "supabase", "seed_exercise_bank_additions.sql")),
];

const unknown = all.filter((row) => isUnknownGroup(row.muscle_group));
const byId = new Map();
for (const row of all) byId.set(row.id, row);

console.log(`Katalog i repo (data.ts + seed SQL): ${byId.size} øvelser`);
console.log(`Med tom/«Ukjent» muskelgruppe: ${unknown.length}`);
if (unknown.length) {
  for (const row of unknown) console.log(`${row.id}\t${row.name}\t${row.source}\t${row.muscle_group || "(tom)"}`);
}

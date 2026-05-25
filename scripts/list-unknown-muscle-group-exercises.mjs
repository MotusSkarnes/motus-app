import fs from "node:fs";
import path from "node:path";

function loadEnv(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore missing env file
  }
}

const root = process.cwd();
loadEnv(path.join(root, ".env"));
loadEnv(path.join(root, "src", ".env"));

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Mangler VITE_SUPABASE_URL og nøkkel i .env");
  process.exit(1);
}

const query =
  "/rest/v1/exercise_bank?select=id,name,category,muscle_group,is_active&order=name.asc&limit=2000";
const response = await fetch(`${url}${query}`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const rows = await response.json();
if (!response.ok) {
  console.error("Query failed:", rows);
  process.exit(1);
}

const unknown = rows.filter((row) => {
  const g = String(row.muscle_group ?? "").trim();
  return !g || g.toLowerCase() === "ukjent";
});

console.log(`Totalt i exercise_bank: ${rows.length}`);
console.log(`Ukjent/tom muskelgruppe: ${unknown.length}\n`);
for (const row of unknown) {
  const g = String(row.muscle_group ?? "").trim() || "(tom)";
  console.log(`${row.id}\t${row.name}\t${row.category}\t${g}\tactive=${row.is_active}`);
}

// Local fallback catalog in src/app/data.ts (demo / før hydrate)
const dataTs = fs.readFileSync(path.join(root, "src", "app", "data.ts"), "utf8");
const localUnknown = [];
const rowRe =
  /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*group:\s*"([^"]*)"/g;
let match;
while ((match = rowRe.exec(dataTs))) {
  const group = match[4].trim();
  if (!group || group.toLowerCase() === "ukjent") {
    localUnknown.push({ id: match[1], name: match[2], category: match[3], group: group || "(tom)" });
  }
}
console.log(`\nLokalt i data.ts (tom/ukjent): ${localUnknown.length}`);
for (const row of localUnknown) {
  console.log(`${row.id}\t${row.name}\t${row.category}\t${row.group}`);
}

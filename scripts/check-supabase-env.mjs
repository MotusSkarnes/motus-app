import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, "src", ".env");
const examplePath = path.join(projectRoot, "src", ".env.example");

function parseEnv(content) {
  const entries = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    entries[key] = value;
  }
  return entries;
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(examplePath)) {
  fail("Mangler src/.env.example");
}

if (!fs.existsSync(envPath)) {
  fail("Mangler src/.env. Lag filen fra src/.env.example.");
}

const envVars = parseEnv(fs.readFileSync(envPath, "utf8"));
const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
const missing = required.filter((key) => !envVars[key]);

if (missing.length > 0) {
  fail(`Mangler verdier i src/.env: ${missing.join(", ")}`);
}

console.log("OK: Supabase env ser komplett ut.");

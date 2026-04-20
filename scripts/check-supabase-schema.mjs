import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, "src", ".env");

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

if (!fs.existsSync(envPath)) {
  fail("Mangler src/.env. Lag filen fra src/.env.example.");
}

const envVars = parseEnv(fs.readFileSync(envPath, "utf8"));
const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  fail("Mangler VITE_SUPABASE_URL eller VITE_SUPABASE_ANON_KEY i src/.env.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const requiredTables = ["members", "chat_messages", "training_programs", "workout_logs"];

async function checkTable(tableName) {
  const { error } = await supabase.from(tableName).select("*", { head: true, count: "exact" });
  if (error) {
    return { tableName, ok: false, error: error.message };
  }
  return { tableName, ok: true, error: null };
}

const results = await Promise.all(requiredTables.map(checkTable));
const failures = results.filter((result) => !result.ok);

for (const result of results) {
  if (result.ok) {
    console.log(`OK: ${result.tableName}`);
  } else {
    console.error(`FAIL: ${result.tableName} -> ${result.error}`);
  }
}

if (failures.length > 0) {
  fail("Supabase schema check feilet. Se feil over.");
}

console.log("OK: Supabase schema ser komplett ut.");

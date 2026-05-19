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
    entries[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return entries;
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`WARN: ${message}`);
}

if (!fs.existsSync(envPath)) {
  fail("Mangler src/.env. Lag filen fra src/.env.example.");
}

const env = parseEnv(fs.readFileSync(envPath, "utf8"));
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const siteUrl = env.VITE_SITE_URL;

if (!supabaseUrl || !supabaseAnonKey) {
  fail("Mangler VITE_SUPABASE_URL eller VITE_SUPABASE_ANON_KEY i src/.env.");
}

if (!siteUrl) {
  warn("VITE_SITE_URL er ikke satt — invitasjon/e-postlenker bruker nettleser-URL (kan feile i prod).");
} else {
  console.log(`OK: VITE_SITE_URL=${siteUrl}`);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const requiredTables = [
  "members",
  "chat_messages",
  "training_programs",
  "workout_logs",
  "exercise_bank",
  "push_subscriptions",
];

for (const tableName of requiredTables) {
  const { error } = await supabase.from(tableName).select("*", { head: true, count: "exact" });
  if (error) {
    console.error(`FAIL: ${tableName} -> ${error.message}`);
    if (tableName === "push_subscriptions") {
      warn("Kjør src/supabase/push_subscriptions_schema.sql eller production_stability_patch.sql");
    }
    if (tableName === "exercise_bank") {
      warn("Kjør src/supabase/exercise_bank_schema.sql");
    }
    process.exitCode = 1;
  } else {
    console.log(`OK: tabell ${tableName}`);
  }
}

const { count: rehabCount, error: rehabError } = await supabase
  .from("exercise_bank")
  .select("id", { head: true, count: "exact" })
  .eq("category", "Rehab");

if (rehabError) {
  warn(`Kunne ikke sjekke Rehab-øvelser: ${rehabError.message}`);
} else if ((rehabCount ?? 0) === 0) {
  warn("Ingen Rehab-øvelser i exercise_bank. Kjør seed_rehab_exercises.sql i Supabase.");
} else {
  console.log(`OK: ${rehabCount} Rehab-øvelser i exercise_bank`);
}

console.log("");
console.log("--- Manuell prod-sjekk (Supabase SQL Editor) ---");
console.log("1. Kjør: src/supabase/production_stability_patch.sql");
console.log("2. Kjør: src/supabase/verification_checks_stability.sql");
console.log("3. Deploy: npm run supabase:deploy-core");
console.log("4. Secrets: PUBLIC_APP_URL, SUPABASE_SERVICE_ROLE_KEY på invite-member");
console.log("");

if (process.exitCode) {
  fail("Production readiness check feilet. Se WARN/FAIL over.");
}

console.log("OK: Production readiness (anon-tabeller) ser bra ut.");

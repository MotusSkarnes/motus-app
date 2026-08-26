import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const supabaseDir = path.join(projectRoot, "src", "supabase");

const requiredPatches = [
  "fix_members_select_own_rls_no_user_metadata.sql",
  "fix_chat_messages_rls_no_user_metadata.sql",
  "fix_training_programs_rls_no_user_metadata.sql",
  "fix_training_programs_member_rls_no_user_metadata.sql",
  "fix_workout_logs_rls_no_user_metadata.sql",
  "fix_member_period_plans_rls_no_user_metadata.sql",
  "fix_member_meal_plans_rls_no_user_metadata.sql",
  "fix_member_meal_plan_state_rls_no_user_metadata.sql",
  "fix_shared_food_bank_items_rls_no_user_metadata.sql",
  "fix_member_workout_log_auth_id_rls.sql",
  "patch_members_insert_trainer_rls.sql",
  "verify_rls_no_user_metadata.sql",
];

let missing = 0;
for (const fileName of requiredPatches) {
  const filePath = path.join(supabaseDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.error(`MISSING: ${fileName}`);
    missing += 1;
    continue;
  }
  console.log(`OK: ${fileName}`);
}

if (missing) {
  console.error(`\n${missing} RLS patch file(s) missing.`);
  process.exit(1);
}

console.log("\nDeploy in Supabase SQL Editor (in order), then run verify_rls_no_user_metadata.sql.");
console.log("Expected verify result: zero rows referencing user_metadata.");

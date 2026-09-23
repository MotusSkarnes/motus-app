import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");

function readSql(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function extractPolicy(sql: string, policyName: string): string {
  const match = sql.match(new RegExp(`create policy "${policyName}"[\\s\\S]*?;`, "i"));
  expect(match?.[0], `missing policy ${policyName}`).toBeTruthy();
  return match![0];
}

function assertMembersInsertRequiresTrustedTrainer(policy: string) {
  expect(policy).toMatch(/owner_user_id\s*=\s*auth\.uid\(\)/);
  expect(policy).toMatch(/app_metadata'\s*->>\s*'role'/);
  expect(policy).toMatch(/=\s*'trainer'/);
  expect(policy).toMatch(/@motus-skarnes\.no/);
  expect(policy).not.toMatch(/user_metadata/);
  expect(policy).not.toMatch(/with check \(\s*owner_user_id = auth\.uid\(\)\s*\);/);
}

const sources = [
  "src/supabase/rls_strict.sql",
  "src/supabase/production_bootstrap.sql",
  "src/supabase/patch_members_insert_trainer_rls.sql",
];

describe("members insert RLS", () => {
  for (const source of sources) {
    it(`${source} requires trainer/staff JWT before creating roster rows`, () => {
      assertMembersInsertRequiresTrustedTrainer(extractPolicy(readSql(source), "members_insert_own"));
    });
  }
});

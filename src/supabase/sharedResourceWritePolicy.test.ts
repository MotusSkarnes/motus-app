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

function assertTrainerStaffGate(policy: string) {
  expect(policy).toMatch(/app_metadata'\s*->>\s*'role'/);
  expect(policy).toMatch(/trainer/);
  expect(policy).toMatch(/@motus-skarnes\.no/);
  expect(policy).not.toMatch(/using\s*\(\s*true\s*\)/);
  expect(policy).not.toMatch(/with check\s*\(\s*true\s*\)/);
}

function assertInsertRequiresMemberOwner(policy: string, tableAliasMemberId: string) {
  expect(policy).toMatch(/m\.owner_user_id\s*=\s*auth\.uid\(\)/);
  expect(policy).toContain(tableAliasMemberId);
  expect(policy).not.toMatch(/with check \(\s*owner_user_id = auth\.uid\(\)\s*\);/);
}

describe("inspiration_feed write RLS", () => {
  it("schema restricts writes to trainer/staff", () => {
    assertTrainerStaffGate(extractPolicy(readSql("src/supabase/inspiration_feed_schema.sql"), "inspiration_feed_write_authenticated"));
  });

  it("patch restricts writes to trainer/staff", () => {
    assertTrainerStaffGate(
      extractPolicy(readSql("src/supabase/patch_inspiration_feed_rls_trainer_write.sql"), "inspiration_feed_write_authenticated"),
    );
  });
});

describe("exercise_bank write RLS", () => {
  it("schema restricts writes to trainer/staff", () => {
    assertTrainerStaffGate(extractPolicy(readSql("src/supabase/exercise_bank_schema.sql"), "exercise_bank_write_authenticated"));
  });

  it("patch restricts writes to trainer/staff", () => {
    assertTrainerStaffGate(
      extractPolicy(readSql("src/supabase/patch_exercise_bank_rls_trainer_write.sql"), "exercise_bank_write_authenticated"),
    );
  });
});

describe("member-owned child insert RLS", () => {
  const sources = [
    "src/supabase/rls_strict.sql",
    "src/supabase/production_bootstrap.sql",
    "src/supabase/patch_member_owned_child_insert_rls.sql",
  ];

  for (const source of sources) {
    it(`${source} requires roster ownership on program/log/period-plan inserts`, () => {
      const sql = readSql(source);
      assertInsertRequiresMemberOwner(
        extractPolicy(sql, "training_programs_insert_own"),
        "training_programs.member_id",
      );
      expect(extractPolicy(sql, "training_programs_insert_own")).toContain("__template__");
      assertInsertRequiresMemberOwner(extractPolicy(sql, "workout_logs_insert_own"), "workout_logs.member_id");
      assertInsertRequiresMemberOwner(
        extractPolicy(sql, "member_period_plans_insert_trainer"),
        "member_period_plans.member_id",
      );
    });
  }

  it("member_period_plans schema requires roster ownership on insert", () => {
    assertInsertRequiresMemberOwner(
      extractPolicy(readSql("src/supabase/member_period_plans_schema.sql"), "member_period_plans_insert_trainer"),
      "member_period_plans.member_id",
    );
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const GUARD_FILES = [
  "src/supabase/patch_training_programs_member_library_column_guard.sql",
  "src/supabase/training_programs_member_library_rls.sql",
  "src/supabase/fix_training_programs_member_rls_no_user_metadata.sql",
  "src/supabase/production_bootstrap.sql",
];

function readSql(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

describe("training program member library column guard", () => {
  it.each(GUARD_FILES)("%s freezes trainer-owned fields for non-owner member updates", (relativePath) => {
    const sql = readSql(relativePath);
    expect(sql).toContain("restrict_member_training_program_updates");
    expect(sql).toContain("training_programs_restrict_member_updates");
    expect(sql).toMatch(/auth\.uid\(\) is null or auth\.uid\(\) is not distinct from old\.owner_user_id/);
    expect(sql).toContain("next_library_status := new.member_library_status");
    expect(sql).toContain("new := old");
    expect(sql).toContain("new.member_library_status := next_library_status");
    expect(sql).toMatch(/before update on public\.training_programs/);
  });

  it("client library persist only sends member_library_status", () => {
    const source = readFileSync(new URL("../services/supabaseRepository.ts", import.meta.url), "utf8");
    expect(source).toMatch(
      /from\("training_programs"\)\.update\(\{\s*member_library_status:\s*status\s*\}\)/,
    );
  });
});

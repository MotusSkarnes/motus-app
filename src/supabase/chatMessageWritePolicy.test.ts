import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");

function readSql(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

/** Guard that chat insert requires roster ownership, not only message owner_user_id. */
function assertInsertPolicyRequiresMemberOwner(sql: string) {
  expect(sql).toContain("chat_messages_insert_own");
  expect(sql).toMatch(/m\.owner_user_id\s*=\s*auth\.uid\(\)/);
  expect(sql).toMatch(/m\.id\s*=\s*chat_messages\.member_id/);
  // Must not ship the old owner-only insert check as the sole with-check clause.
  expect(sql).not.toMatch(
    /create policy "chat_messages_insert_own"[\s\S]*?with check \(\s*owner_user_id = auth\.uid\(\)\s*\);/,
  );
}

describe("chat_messages write RLS", () => {
  it("strict RLS requires member roster ownership on insert", () => {
    assertInsertPolicyRequiresMemberOwner(readSql("src/supabase/rls_strict.sql"));
  });

  it("production bootstrap requires member roster ownership on insert", () => {
    assertInsertPolicyRequiresMemberOwner(readSql("src/supabase/production_bootstrap.sql"));
  });

  it("ownership patch requires member roster ownership on insert", () => {
    assertInsertPolicyRequiresMemberOwner(
      readSql("src/supabase/patch_chat_messages_rls_require_member_owner.sql"),
    );
  });
});

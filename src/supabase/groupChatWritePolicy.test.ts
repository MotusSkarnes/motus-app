import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");

function readSql(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function extractGroupChatInsertPolicy(sql: string): string {
  const match = sql.match(
    /create policy "group_chat_messages_insert"[\s\S]*?with check \([\s\S]*?\);/,
  );
  expect(match?.[0]).toBeTruthy();
  return match![0];
}

/** Guard that trainer group-chat inserts require owning the training group. */
function assertTrainerInsertRequiresGroupOwner(sql: string) {
  const policy = extractGroupChatInsertPolicy(sql);
  expect(policy).toContain("group_chat_messages_insert");
  expect(policy).toMatch(/sender_role = 'trainer'/);
  expect(policy).toMatch(/g\.id\s*=\s*group_chat_messages\.group_id/);
  expect(policy).toMatch(/g\.owner_user_id\s*=\s*auth\.uid\(\)/);
  expect(policy).toMatch(/sender_member_id is null/);
  expect(policy).not.toMatch(
    /owner_user_id = auth\.uid\(\)\s+and sender_role = 'trainer'\s+\)\s+or/,
  );
}

describe("group_chat_messages write RLS", () => {
  it("training groups schema requires group ownership on trainer inserts", () => {
    assertTrainerInsertRequiresGroupOwner(readSql("src/supabase/training_groups_schema.sql"));
  });

  it("ownership patch requires group ownership on trainer inserts", () => {
    assertTrainerInsertRequiresGroupOwner(
      readSql("src/supabase/patch_group_chat_messages_insert_require_group_owner.sql"),
    );
  });
});

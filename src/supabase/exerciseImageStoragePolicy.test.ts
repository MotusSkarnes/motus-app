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

function assertScopedExerciseImageWrite(policy: string) {
  expect(policy).toMatch(/app_metadata'\s*->>\s*'role'/);
  expect(policy).toMatch(/trainer/);
  expect(policy).toMatch(/@motus-skarnes\.no/);
  expect(policy).toMatch(/exercise-bank\//);
  expect(policy).toMatch(/food-bank\//);
  expect(policy).toMatch(/program-covers\//);
  expect(policy).toMatch(/inspiration\//);
  expect(policy).toMatch(/member-avatars\/email-/);
  expect(policy).toMatch(/motus_storage_email_path_token/);
  expect(policy).not.toMatch(/with check \(\s*bucket_id = 'exercise-images'\s*\);/);
  expect(policy).not.toMatch(/using \(\s*bucket_id = 'exercise-images'\s*\);/);
}

describe("exercise-images storage write RLS", () => {
  const sources = [
    "src/supabase/exercise_image_storage.sql",
    "src/supabase/patch_exercise_images_storage_rls.sql",
  ];

  for (const source of sources) {
    it(`${source} scopes upload/update/delete to trainer prefixes or own email avatar`, () => {
      const sql = readSql(source);
      expect(sql).toMatch(/motus_storage_email_path_token/);
      assertScopedExerciseImageWrite(extractPolicy(sql, "exercise_images_authenticated_upload"));
      assertScopedExerciseImageWrite(extractPolicy(sql, "exercise_images_authenticated_update"));
      assertScopedExerciseImageWrite(extractPolicy(sql, "exercise_images_authenticated_delete"));
    });
  }

  it("email path token SQL matches client base64url encoding for ascii emails", () => {
    // Documented parity: translate(rtrim(encode(convert_to(lower(trim(email)),'UTF8'),'base64'),'='), '+/', '-_')
    // equals btoa(unescape(encodeURIComponent(email))).replace(+/, -_).replace(/=+$/, '')
    const email = "jane_doe@example.com";
    const nodeToken = Buffer.from(email, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    expect(nodeToken).toBe("amFuZV9kb2VAZXhhbXBsZS5jb20");
    expect(`member-avatars/email-${nodeToken}.jpg`).toBe(
      "member-avatars/email-amFuZV9kb2VAZXhhbXBsZS5jb20.jpg",
    );
  });
});

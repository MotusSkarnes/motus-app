import { afterEach, describe, expect, it } from "vitest";
import {
  addArchiveTombstone,
  getArchiveTombstones,
  reconcileArchiveTombstonesWithRemoteMembers,
} from "./memberArchiveTombstone";

const STORAGE_KEY = "motus.archivedMemberEmails";

describe("reconcileArchiveTombstonesWithRemoteMembers", () => {
  afterEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it("removes tombstone when remote member is active", () => {
    addArchiveTombstone("karen@setergard.no");
    expect(getArchiveTombstones().has("karen@setergard.no")).toBe(true);

    reconcileArchiveTombstonesWithRemoteMembers([
      { email: "karen@setergard.no", isActive: true },
    ]);

    expect(getArchiveTombstones().has("karen@setergard.no")).toBe(false);
  });

  it("keeps tombstone when remote member is inactive", () => {
    addArchiveTombstone("karen@setergard.no");

    reconcileArchiveTombstonesWithRemoteMembers([
      { email: "karen@setergard.no", isActive: false },
    ]);

    expect(getArchiveTombstones().has("karen@setergard.no")).toBe(true);
  });
});

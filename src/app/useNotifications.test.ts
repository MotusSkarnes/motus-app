import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useNotifications } from "./useNotifications";
import type { WorkoutLog } from "./types";

function makeLog(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: "log-1",
    memberId: "member-1",
    programTitle: "Styrke A",
    date: "15.05.2026",
    status: "Fullført",
    trainerComment: "Bra jobba!",
    trainerCommentUpdatedAt: "2026-05-15T10:00:00.000Z",
    trainerCommentAuthorName: "PT Lene",
    results: [],
    ...overrides,
  };
}

describe("useNotifications workout comment alerts", () => {
  it("counts unread workout comment alerts for completed logs", () => {
    const { result } = renderHook(() =>
      useNotifications({
        messages: [],
        programs: [],
        logs: [makeLog()],
        members: [{ id: "member-1", name: "Test", email: "test@example.com" } as never],
        memberViewId: "member-1",
        setMemberTab: () => {},
      }),
    );

    expect(result.current.memberUnreadCount).toBeGreaterThan(0);
    expect(result.current.memberVisibleAlerts.length).toBeGreaterThan(0);
    expect(result.current.memberVisibleAlerts[0]?.isUnread).toBe(true);
  });

  it("keeps recent alerts visible after marking as seen", () => {
    const { result, rerender } = renderHook(
      (props) => useNotifications(props),
      {
        initialProps: {
          messages: [],
          programs: [],
          logs: [makeLog()],
          members: [{ id: "member-1", name: "Test", email: "test@example.com" } as never],
          memberViewId: "member-1",
          setMemberTab: () => {},
        },
      },
    );

    expect(result.current.memberUnreadCount).toBe(1);
    result.current.handleMemberBellToggle();
    rerender({
      messages: [],
      programs: [],
      logs: [makeLog()],
      members: [{ id: "member-1", name: "Test", email: "test@example.com" } as never],
      memberViewId: "member-1",
      setMemberTab: () => {},
    });
    expect(result.current.memberUnreadCount).toBe(0);
    expect(result.current.memberVisibleAlerts.length).toBe(1);
    expect(result.current.memberVisibleAlerts[0]?.isUnread).toBe(false);
  });

  it("ignores workout comments on non-completed logs", () => {
    const { result } = renderHook(() =>
      useNotifications({
        messages: [],
        programs: [],
        logs: [makeLog({ status: "Planlagt" })],
        members: [{ id: "member-1", name: "Test", email: "test@example.com" } as never],
        memberViewId: "member-1",
        setMemberTab: () => {},
      }),
    );

    expect(result.current.memberUnreadCount).toBe(0);
  });
});

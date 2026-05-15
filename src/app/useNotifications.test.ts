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

  it("keeps recent trainer alerts visible after marking as seen", () => {
    const members = [
      { id: "member-1", name: "Kari", email: "kari@example.com", invitedAt: "2026-01-01" } as never,
      { id: "member-2", name: "Ola", email: "ola@example.com" } as never,
    ];
    const messages = [
      {
        id: "msg-1",
        memberId: "member-1",
        sender: "member" as const,
        text: "Hei trener",
        createdAt: "2026-05-15T12:00:00.000Z",
      },
    ];

    const { result, rerender } = renderHook(
      (props) => useNotifications(props),
      {
        initialProps: {
          messages,
          programs: [],
          logs: [],
          members,
          memberViewId: "member-1",
          setMemberTab: () => {},
        },
      },
    );

    expect(result.current.trainerUnreadCount).toBeGreaterThan(0);
    result.current.handleTrainerBellToggle();
    rerender({
      messages,
      programs: [],
      logs: [],
      members,
      memberViewId: "member-1",
      setMemberTab: () => {},
    });
    expect(result.current.trainerUnreadCount).toBe(0);
    expect(result.current.trainerVisibleAlerts.length).toBeGreaterThan(0);
    expect(result.current.trainerVisibleAlerts[0]?.isUnread).toBe(false);
  });

  it("includes operational trainer alerts for missing invites", () => {
    const members = [{ id: "member-1", name: "Ola", email: "ola@example.com" } as never];
    const { result } = renderHook(() =>
      useNotifications({
        messages: [],
        programs: [],
        logs: [],
        members,
        memberViewId: "member-1",
        setMemberTab: () => {},
      }),
    );

    const operational = result.current.trainerVisibleAlerts.find((alert) => alert.kind === "missing-invite");
    expect(operational).toBeDefined();
    expect(operational?.isUnread).toBe(true);
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

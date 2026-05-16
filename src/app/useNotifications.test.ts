import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { INSPIRATION_CHANGED_EVENT, INSPIRATION_STORAGE_KEY } from "./inspirationStorage";
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
  afterEach(() => {
    window.localStorage.removeItem(INSPIRATION_STORAGE_KEY);
    window.localStorage.removeItem("motus.notifications.memberInspirationBaselineAt");
    window.localStorage.removeItem("motus.notifications.memberSeenInspirationIds");
  });

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

  it("excludes deactivated members from operational trainer alerts", () => {
    const members = [
      { id: "member-1", name: "Ola", email: "ola@example.com", isActive: false, invitedAt: "" } as never,
    ];
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

    expect(result.current.trainerVisibleAlerts.filter((a) => a.kind === "missing-invite")).toHaveLength(0);
    expect(result.current.trainerVisibleAlerts.filter((a) => a.kind === "inactive-member")).toHaveLength(0);
    expect(result.current.trainerUnreadCount).toBe(0);
  });

  it("counts unread inspiration alerts when a new inspo item is published", async () => {
    window.localStorage.setItem("motus.notifications.memberInspirationBaselineAt", String(Date.now()));
    window.localStorage.setItem("motus.notifications.memberSeenInspirationIds", JSON.stringify(["default-recipe-1"]));

    const { result } = renderHook(() =>
      useNotifications({
        messages: [],
        programs: [],
        logs: [],
        members: [{ id: "member-1", name: "Test", email: "test@example.com" } as never],
        memberViewId: "member-1",
        setMemberTab: () => {},
      }),
    );

    expect(result.current.memberUnreadCount).toBe(0);

    window.localStorage.setItem(
      INSPIRATION_STORAGE_KEY,
      JSON.stringify([
        { id: "default-recipe-1", title: "Gammel", description: "Eksisterer", createdAt: "2026-05-01" },
        {
          id: "inspiration-new",
          title: "Proteinpannekaker",
          description: "Fersk inspo",
          createdAt: "2026-05-16",
          category: "recipes",
          kind: "article",
        },
      ]),
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(INSPIRATION_CHANGED_EVENT));
    });

    await waitFor(() => {
      expect(result.current.memberUnreadCount).toBe(1);
      const inspoAlert = result.current.memberVisibleAlerts.find((alert) => alert.kind === "inspiration");
      expect(inspoAlert).toBeDefined();
      expect(inspoAlert?.title).toBe("Ny oppskrift i inspirasjon");
      expect(inspoAlert?.detail).toBe("Proteinpannekaker");
    });
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

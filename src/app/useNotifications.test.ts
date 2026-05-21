import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/supabaseClient", () => ({
  isSupabaseConfigured: false,
  supabaseClient: null,
}));
import { formatNotificationTimestamp } from "./dateFormat";
import { INSPIRATION_CHANGED_EVENT, INSPIRATION_STORAGE_KEY } from "./inspirationStorage";
import { useNotifications } from "./useNotifications";
import type { MemberTab, PeriodSchedulePlan, TrainingProgram, WorkoutLog } from "./types";

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
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.removeItem(INSPIRATION_STORAGE_KEY);
    window.localStorage.removeItem("motus.notifications.memberInspirationBaselineAt");
    window.localStorage.removeItem("motus.notifications.memberSeenInspirationIds");
    window.localStorage.removeItem("motus.notifications.trainerBaselineAt");
    window.localStorage.removeItem("motus.notifications.trainerSeenAt");
    window.localStorage.removeItem("motus.notifications.trainerSeenMemberFormKeys");
    window.localStorage.removeItem("motus.notifications.trainerOperationalSeenKey");
    window.localStorage.removeItem("motus.notifications.trainerOpenedAlertIds");
    window.localStorage.removeItem("motus.notifications.memberDismissedCheckInMonths");
    window.localStorage.removeItem("motus.notifications.memberSeenAt");
    window.localStorage.removeItem("motus.notifications.memberSeenProgramIds");
    window.localStorage.removeItem("motus.notifications.memberSeenWorkoutCommentKeys");
    window.localStorage.removeItem("motus.notifications.memberOpenedAlertIds");
    window.localStorage.removeItem("motus.notifications.memberSeenPeriodPlanKeys");
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

  it("keeps unread styling until the alert is opened", () => {
    const { result } = renderHook(
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
    act(() => {
      result.current.handleMemberBellToggle();
    });
    expect(result.current.memberNotificationsOpen).toBe(true);
    expect(result.current.memberUnreadCount).toBe(1);
    expect(result.current.memberVisibleAlerts[0]?.isUnread).toBe(true);

    const unreadBeforeClick = result.current.memberVisibleAlerts[0]!;
    act(() => {
      result.current.openAlert(unreadBeforeClick);
    });
    expect(result.current.memberUnreadCount).toBe(0);
    expect(result.current.memberVisibleAlerts.length).toBe(0);
  });

  it("sorts newest trainer message alerts first among unread", async () => {
    const members = [
      { id: "member-1", name: "Kari", email: "kari@example.com", invitedAt: "2026-01-01" } as never,
      { id: "member-2", name: "Ola", email: "ola@example.com", invitedAt: "2026-01-01" } as never,
    ];
    const initialMessages = [
      {
        id: "msg-old",
        memberId: "member-1",
        sender: "member" as const,
        text: "Gammel",
        createdAt: "10.05.2026 kl 09:00",
      },
    ];

    const { result, rerender } = renderHook((props) => useNotifications(props), {
      initialProps: {
        messages: initialMessages,
        programs: [],
        logs: [],
        members,
        memberViewId: "member-1",
        setMemberTab: () => {},
        currentUserRole: "trainer" as const,
      },
    });

    await waitFor(() => {
      expect(result.current.trainerUnreadCount).toBe(0);
    });

    rerender({
      messages: [
        ...initialMessages,
        {
          id: "msg-new",
          memberId: "member-2",
          sender: "member" as const,
          text: "Nyeste",
          createdAt: "15.05.2026 kl 14:30",
        },
      ],
      programs: [],
      logs: [],
      members,
      memberViewId: "member-1",
      currentUserRole: "trainer",
      setMemberTab: () => {},
    });

    await waitFor(() => {
      expect(result.current.trainerVisibleAlerts[0]?.id).toBe("trainer-msg-msg-new");
      expect(result.current.trainerVisibleAlerts[0]?.isUnread).toBe(true);
    });
  });

  it("keeps trainer alerts unread until opened", async () => {
    const members = [
      { id: "member-1", name: "Kari", email: "kari@example.com", invitedAt: "2026-01-01" } as never,
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

    const { result, rerender } = renderHook((props) => useNotifications(props), {
      initialProps: {
        messages: [],
        programs: [],
        logs: [],
        members,
        memberViewId: "member-1",
        setMemberTab: () => {},
        currentUserRole: "trainer" as const,
      },
    });

    await waitFor(() => {
      expect(window.localStorage.getItem("motus.notifications.trainerBaselineAt")).toBeTruthy();
    });

    rerender({
      messages,
      programs: [],
      logs: [],
      members,
      memberViewId: "member-1",
      currentUserRole: "trainer",
      setMemberTab: () => {},
    });

    await waitFor(() => {
      expect(result.current.trainerUnreadCount).toBeGreaterThan(0);
    });
    act(() => {
      result.current.handleTrainerBellToggle();
    });
    expect(result.current.trainerUnreadCount).toBeGreaterThan(0);

    act(() => {
      result.current.openTrainerAlert(result.current.trainerVisibleAlerts[0]!);
    });
    expect(result.current.trainerUnreadCount).toBe(0);
    expect(result.current.trainerVisibleAlerts[0]?.isUnread).toBe(false);
  });

  it("keeps operational alerts read after opening even when roster changes", () => {
    window.localStorage.setItem("motus.notifications.trainerBaselineAt", "1");
    const members = [
      { id: "member-1", name: "Ola", email: "ola@example.com", isActive: true } as never,
      { id: "member-2", name: "Kari", email: "kari@example.com", isActive: true, daysSinceActivity: "14" } as never,
    ];
    const { result, rerender } = renderHook(() =>
      useNotifications({
        messages: [],
        programs: [],
        logs: [],
        members,
        memberViewId: "member-1",
        currentUserRole: "trainer",
        setMemberTab: () => {},
      }),
    );

    const inviteAlert = result.current.trainerVisibleAlerts.find((alert) => alert.kind === "missing-invite");
    expect(inviteAlert?.isUnread).toBe(true);

    act(() => {
      result.current.openTrainerAlert(inviteAlert!);
    });
    expect(result.current.trainerUnreadCount).toBeGreaterThan(0);

    rerender({
      messages: [],
      programs: [],
      logs: [],
      members: [
        ...members,
        { id: "member-3", name: "Per", email: "per@example.com", isActive: true, daysSinceActivity: "21" } as never,
      ],
      memberViewId: "member-1",
      currentUserRole: "trainer",
      setMemberTab: () => {},
    });

    const inviteAfter = result.current.trainerVisibleAlerts.find((alert) => alert.kind === "missing-invite");
    expect(inviteAfter?.isUnread).toBe(false);
    expect(inviteAfter?.isOpened).toBe(true);
  });

  it("does not show epoch date on operational trainer alerts", () => {
    window.localStorage.setItem("motus.notifications.trainerBaselineAt", "1");
    const members = [{ id: "member-1", name: "Ola", email: "ola@example.com", isActive: true } as never];
    const { result } = renderHook(() =>
      useNotifications({
        messages: [],
        programs: [],
        logs: [],
        members,
        memberViewId: "member-1",
        currentUserRole: "trainer",
        setMemberTab: () => {},
      }),
    );

    const operational = result.current.trainerVisibleAlerts.find((alert) => alert.kind === "missing-invite");
    expect(operational?.timestamp).toBe(0);
    expect(formatNotificationTimestamp(operational?.timestamp ?? 0)).toBe("");
  });

  it("includes operational trainer alerts for missing invites", () => {
    window.localStorage.setItem("motus.notifications.trainerBaselineAt", "1");
    const members = [{ id: "member-1", name: "Ola", email: "ola@example.com" } as never];
    const { result } = renderHook(() =>
      useNotifications({
        messages: [],
        programs: [],
        logs: [],
        members,
        memberViewId: "member-1",
        currentUserRole: "trainer",
        setMemberTab: () => {},
      }),
    );

    const operational = result.current.trainerVisibleAlerts.find((alert) => alert.kind === "missing-invite");
    expect(operational).toBeDefined();
    expect(operational?.isUnread).toBe(true);
  });

  it("does not count historical trainer alerts as unread on a fresh device", async () => {
    const members = [
      { id: "member-1", name: "Kari", email: "kari@example.com", invitedAt: "2026-01-01", isActive: true } as never,
    ];
    const messages = [
      {
        id: "msg-old",
        memberId: "member-1",
        sender: "member" as const,
        text: "Gammel melding",
        createdAt: "2026-05-01T12:00:00.000Z",
      },
    ];

    const { result } = renderHook(() =>
      useNotifications({
        messages,
        programs: [],
        logs: [],
        members,
        memberViewId: "member-1",
        currentUserRole: "trainer",
        setMemberTab: () => {},
      }),
    );

    await waitFor(() => {
      expect(result.current.trainerUnreadCount).toBe(0);
    });
    expect(result.current.trainerVisibleAlerts).toHaveLength(0);
  });

  it("does not show historical trainer form alerts on a fresh device", async () => {
    const goals = `MOTUS_PROFILE_V1:${JSON.stringify({
      onboarding: {
        version: 1,
        completedAt: "2026-05-01T12:00:00.000Z",
        skipped: false,
        trainingGoals: ["Styrke"],
        goalsNotes: "",
        importanceNow: 7,
        experienceLevel: "Nybegynner",
        level: "Nybegynner",
        currentWeeklySessions: "2",
        sessionsPerWeekTarget: "3",
        preferredSessionMinutes: "60",
        trainingForms: [],
        motivations: [],
        energyInTraining: "",
        consistencyHelpers: "",
        injuries: "",
        dropoutReasons: [],
        dropoutNotes: "",
        preferredTrainingTime: "",
        wantsTrainerStructure: "",
        coachNotesFromMember: "",
      },
    })}`;
    const members = [
      { id: "member-1", name: "Kari", email: "kari@example.com", invitedAt: "2026-01-01", isActive: true, personalGoals: goals } as never,
    ];

    const { result } = renderHook(() =>
      useNotifications({
        messages: [],
        programs: [],
        logs: [],
        members,
        memberViewId: "member-1",
        currentUserRole: "trainer",
        setMemberTab: () => {},
      }),
    );

    await waitFor(() => {
      expect(result.current.trainerUnreadCount).toBe(0);
    });
    expect(result.current.trainerVisibleAlerts.some((alert) => alert.kind === "member-form")).toBe(false);
  });

  it("counts new member messages as unread after trainer device baseline", async () => {
    const members = [
      { id: "member-1", name: "Kari", email: "kari@example.com", invitedAt: "2026-01-01", isActive: true } as never,
    ];
    const initialMessages = [
      {
        id: "msg-old",
        memberId: "member-1",
        sender: "member" as const,
        text: "Gammel melding",
        createdAt: "2026-05-01T12:00:00.000Z",
      },
    ];

    const { result, rerender } = renderHook((props) => useNotifications(props), {
      initialProps: {
        messages: initialMessages,
        programs: [],
        logs: [],
        members,
        memberViewId: "member-1",
        currentUserRole: "trainer" as const,
        setMemberTab: () => {},
      },
    });

    await waitFor(() => {
      expect(result.current.trainerUnreadCount).toBe(0);
    });

    rerender({
      messages: [
        ...initialMessages,
        {
          id: "msg-new",
          memberId: "member-1",
          sender: "member" as const,
          text: "Ny melding",
          createdAt: "2026-05-16T12:00:00.000Z",
        },
      ],
      programs: [],
      logs: [],
      members,
      memberViewId: "member-1",
      currentUserRole: "trainer",
      setMemberTab: () => {},
    });

    await waitFor(() => {
      expect(result.current.trainerUnreadCount).toBe(1);
    });
  });

  it("shows unread onboarding form alert after trainer device baseline", async () => {
    const goals = `MOTUS_PROFILE_V1:${JSON.stringify({
      onboarding: {
        version: 1,
        completedAt: "2026-05-16T12:00:00.000Z",
        skipped: false,
        trainingGoals: ["Styrke"],
        goalsNotes: "",
        importanceNow: 7,
        experienceLevel: "Nybegynner",
        level: "Nybegynner",
        currentWeeklySessions: "2",
        sessionsPerWeekTarget: "3",
        preferredSessionMinutes: "60",
        trainingForms: [],
        motivations: [],
        energyInTraining: "",
        consistencyHelpers: "",
        injuries: "",
        dropoutReasons: [],
        dropoutNotes: "",
        preferredTrainingTime: "",
        wantsTrainerStructure: "",
        coachNotesFromMember: "",
      },
    })}`;
    const members = [
      { id: "member-1", name: "Kari", email: "kari@example.com", invitedAt: "2026-01-01", isActive: true, personalGoals: goals } as never,
    ];

    const { result, rerender } = renderHook((props) => useNotifications(props), {
      initialProps: {
        messages: [],
        programs: [],
        logs: [],
        members: [{ ...members[0], personalGoals: "" } as never],
        memberViewId: "member-1",
        currentUserRole: "trainer" as const,
        setMemberTab: () => {},
      },
    });

    await waitFor(() => {
      expect(window.localStorage.getItem("motus.notifications.trainerBaselineAt")).toBeTruthy();
    });
    expect(result.current.trainerUnreadCount).toBe(0);

    rerender({
      messages: [],
      programs: [],
      logs: [],
      members,
      memberViewId: "member-1",
      currentUserRole: "trainer",
      setMemberTab: () => {},
    });

    await waitFor(() => {
      expect(result.current.trainerUnreadCount).toBe(1);
    });
    expect(result.current.trainerVisibleAlerts.some((a) => a.kind === "member-form" && a.title === "Nytt oppstartsskjema")).toBe(true);
  });

  it("does not flag activated members without invited_at as missing invite", async () => {
    const goals = `MOTUS_PROFILE_V1:${JSON.stringify({
      onboarding: { completedAt: "2026-05-01T12:00:00.000Z", skipped: false },
      onboardingCompletedAt: "2026-05-01T12:00:00.000Z",
    })}`;
    const members = [
      { id: "m-kari", name: "Kari", email: "kari@test.no", invitedAt: "", isActive: true, personalGoals: goals } as never,
      { id: "auth-kari", name: "Kari", email: "kari@test.no", invitedAt: "", isActive: true, personalGoals: "" } as never,
    ];

    const { result } = renderHook(() =>
      useNotifications({
        messages: [],
        programs: [],
        logs: [],
        members,
        memberViewId: "member-1",
        currentUserRole: "trainer",
        setMemberTab: () => {},
      }),
    );

    await waitFor(() => {
      expect(result.current.trainerVisibleAlerts.filter((a) => a.kind === "missing-invite")).toHaveLength(0);
    });
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
    window.localStorage.setItem("motus.notifications.memberInspirationBaselineAt", "1");
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
      expect(inspoAlert?.title).toBe("Proteinpannekaker");
      expect(inspoAlert?.detail).toBe("Ny oppskrift");
    });
  });

  it("keeps unread inspiration visible after opening the bell", async () => {
    window.localStorage.setItem("motus.notifications.memberInspirationBaselineAt", "1");
    window.localStorage.setItem("motus.notifications.memberSeenInspirationIds", JSON.stringify([]));

    window.localStorage.setItem(
      INSPIRATION_STORAGE_KEY,
      JSON.stringify([
        {
          id: "inspiration-new",
          title: "Sommerkondis",
          description: "Ny økt",
          createdAt: "2026-05-16",
          category: "programs",
          kind: "article",
        },
      ]),
    );

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

    act(() => {
      window.dispatchEvent(new CustomEvent(INSPIRATION_CHANGED_EVENT));
    });

    await waitFor(() => expect(result.current.memberUnreadCount).toBe(1));

    act(() => {
      result.current.handleMemberBellToggle();
    });

    await waitFor(() => {
      const inspoAlert = result.current.memberVisibleAlerts.find((alert) => alert.kind === "inspiration");
      expect(inspoAlert).toBeDefined();
      expect(inspoAlert?.title).toBe("Sommerkondis");
      expect(inspoAlert?.isUnread).toBe(true);
    });
  });

  it("opens programs tab and focuses workout when comment alert is opened", () => {
    let memberTab: MemberTab = "overview";
    const { result } = renderHook(() =>
      useNotifications({
        messages: [],
        programs: [],
        logs: [makeLog()],
        members: [{ id: "member-1", name: "Test", email: "test@example.com" } as never],
        memberViewId: "member-1",
        setMemberTab: (tab) => {
          memberTab = tab;
        },
      }),
    );

    const alert = result.current.memberVisibleAlerts.find((item) => item.kind === "workout-comment");
    expect(alert).toBeDefined();

    act(() => {
      result.current.openAlert(alert!);
    });

    expect(memberTab).toBe("programs");
    expect(result.current.memberFocusWorkoutLogId).toBe("log-1");
  });

  it("opens programs tab and focuses program when new program alert is opened", () => {
    let memberTab: MemberTab = "overview";
    const trainerProgram: TrainingProgram = {
      id: "program-1",
      memberId: "member-1",
      title: "4x4 intervall",
      goal: "Kondis",
      notes: "",
      exercises: [],
      createdAt: "20.05.2026",
      programCreatedBy: "trainer",
    };
    const { result } = renderHook(() =>
      useNotifications({
        messages: [],
        programs: [trainerProgram],
        logs: [],
        members: [{ id: "member-1", name: "Test", email: "test@example.com" } as never],
        memberViewId: "member-1",
        setMemberTab: (tab) => {
          memberTab = tab;
        },
      }),
    );

    const alert = result.current.memberVisibleAlerts.find((item) => item.kind === "program");
    expect(alert).toBeDefined();

    act(() => {
      result.current.openAlert(alert!);
    });

    expect(memberTab).toBe("programs");
    expect(result.current.memberFocusProgramId).toBe("program-1");
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

  it("does not count trainer messages that were opened but still in history", () => {
    window.localStorage.setItem("motus.notifications.trainerBaselineAt", "1");
    window.localStorage.setItem("motus.notifications.trainerSeenAt", "1");
    window.localStorage.setItem(
      "motus.notifications.trainerOpenedAlertIds",
      JSON.stringify(["trainer-msg-msg-1"]),
    );
    const messages = [
      {
        id: "msg-1",
        memberId: "member-1",
        sender: "member" as const,
        text: "Hei trener",
        createdAt: "2026-05-15T12:00:00.000Z",
      },
    ];

    const { result } = renderHook(() =>
      useNotifications({
        messages,
        programs: [],
        logs: [],
        members: [{ id: "member-1", name: "Kari", email: "kari@example.com", invitedAt: "2026-01-01" } as never],
        memberViewId: "member-1",
        setMemberTab: () => {},
        currentUserRole: "trainer",
      }),
    );

    expect(result.current.trainerUnreadCount).toBe(0);
    expect(result.current.trainerVisibleAlerts[0]?.isUnread).toBe(false);
  });
});

describe("useNotifications period plan alerts", () => {
  afterEach(() => {
    window.localStorage.removeItem("motus.notifications.memberSeenPeriodPlanKeys");
    window.localStorage.removeItem("motus.notifications.memberOpenedAlertIds");
  });

  const trainerPlan: PeriodSchedulePlan = {
    id: "plan-1",
    title: "Mai–juni",
    notes: "Fokus styrke",
    startDate: "05.05.2026",
    weeks: 4,
    createdAt: "05.05.2026",
    weeklyPlans: [],
    periodPlanAddedBy: "trainer",
    trainerSavedAtIso: "2026-05-20T08:00:00.000Z",
  };

  it("counts unread period plan alerts from remote rows", () => {
    const { result } = renderHook(() =>
      useNotifications({
        messages: [],
        programs: [],
        logs: [],
        members: [{ id: "member-1", name: "Test", email: "test@example.com" } as never],
        memberViewId: "member-1",
        remoteMemberPeriodPlanRows: [{ memberId: "member-1", plan: trainerPlan }],
        setMemberTab: () => {},
      }),
    );

    const alert = result.current.memberVisibleAlerts.find((item) => item.kind === "period-plan");
    expect(alert).toBeDefined();
    expect(alert?.isUnread).toBe(true);
    expect(result.current.memberUnreadCount).toBeGreaterThan(0);
  });

  it("opens overview and marks period plan alert as seen", () => {
    let memberTab: MemberTab = "programs";
    const { result } = renderHook(() =>
      useNotifications({
        messages: [],
        programs: [],
        logs: [],
        members: [{ id: "member-1", name: "Test", email: "test@example.com" } as never],
        memberViewId: "member-1",
        remoteMemberPeriodPlanRows: [{ memberId: "member-1", plan: trainerPlan }],
        setMemberTab: (tab) => {
          memberTab = tab;
        },
      }),
    );

    const alert = result.current.memberVisibleAlerts.find((item) => item.kind === "period-plan");
    act(() => {
      result.current.openAlert(alert!);
    });

    expect(memberTab).toBe("overview");
    expect(result.current.memberVisibleAlerts.find((item) => item.kind === "period-plan")).toBeUndefined();
    expect(result.current.memberUnreadCount).toBe(0);
  });
});

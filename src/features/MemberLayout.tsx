import { useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { Bell, CheckCircle2, ChevronRight, ClipboardList, ClipboardPenLine, MessageSquare, Sparkles, TrendingUp } from "lucide-react";
import { MOTUS } from "../app/data";
import { formatNotificationTimestamp } from "../app/dateFormat";
import {
  enrichMemberWithBestProfile,
  findMembersByEmail,
  isOnboardingCompleted,
  pickCanonicalMemberRowForProfile,
  markOnboardingGateSeen,
  markMemberWelcomeSeen,
  memberOnboardingIdentityKey,
  mergeOnboardingIntoPersonalGoals,
  onboardingDraftFromStored,
  primaryGoalFromOnboarding,
  shouldShowMemberOnboarding,
  hasSeenMemberWelcome,
  type MemberOnboardingAnswers,
} from "../app/memberOnboarding";
import { normalizePeriodSchedulePlan, readPeriodPlansByMemberId, writePeriodPlansByMemberId } from "../app/periodPlanMerge";
import type { AppState, Member, MemberTab, PeriodSchedulePlan } from "../app/types";
import { ensureMemberAuthLink } from "../services/supabaseAuth";
import { Card } from "../app/ui";
import type { MemberAlert } from "../app/useNotifications";
import { isMemberAppAccessBlocked, memberRecordIsActive, MEMBER_ARCHIVED_APP_MESSAGE } from "../services/memberAccessRules";
import { persistOnboardingToSupabase, upsertMemberPeriodPlansForTrainer } from "../services/supabaseRepository";
import {
  mergeCheckInIntoPersonalGoals,
  resolveCheckInWindow,
  type MemberMonthlyCheckInAnswers,
} from "../app/memberMonthlyCheckIn";
import { MemberMonthlyCheckIn } from "./MemberMonthlyCheckIn";
import { MemberOnboarding } from "./MemberOnboarding";
import { MemberWelcomeModal } from "./MemberWelcomeModal";
import { MemberPortal } from "./MemberPortal";
import { InspirationHub } from "./InspirationHub";
import { MemberDesktopTabNav, MemberMobileTabNav } from "./MemberTabNavigation";

function resolveActiveMemberForUser(appState: AppState): Member | null {
  const currentUser = appState.currentUser;
  if (!currentUser) return null;
  const normalizedEmail = currentUser.email.trim().toLowerCase();
  const candidates = appState.members.filter((member) => {
    if (!memberRecordIsActive(member)) return false;
    if (currentUser.memberId && member.id === currentUser.memberId) return true;
    if (appState.memberViewId && member.id === appState.memberViewId) return true;
    return Boolean(normalizedEmail && member.email.trim().toLowerCase() === normalizedEmail);
  });
  if (!candidates.length) return null;
  return (
    candidates.find((member) => member.customerType === "PT-kunde") ??
    candidates.find((member) => member.membershipType === "Premium") ??
    candidates.find((member) => member.customerType !== "Medlem") ??
    candidates[0]
  );
}

type MemberLayoutProps = {
  appState: AppState;
  patchState: (patch: Partial<AppState> | ((prev: AppState) => AppState)) => void;
  memberTab: MemberTab;
  setMemberTab: (tab: MemberTab) => void;
  updateMember: ComponentProps<typeof MemberPortal>["updateMember"];
  currentMemberAvatarUrl: string;
  setCurrentMemberAvatarUrl: (url: string) => void;
  sendMemberMessage: ComponentProps<typeof MemberPortal>["sendMemberMessage"];
  startWorkoutMode: ComponentProps<typeof MemberPortal>["startWorkoutMode"];
  startCustomWorkout: ComponentProps<typeof MemberPortal>["startCustomWorkout"];
  saveProgramForMember: ComponentProps<typeof MemberPortal>["saveProgramForMember"];
  deleteProgramById: ComponentProps<typeof MemberPortal>["deleteProgramById"];
  updateProgramMemberLibraryStatus: ComponentProps<typeof MemberPortal>["updateProgramMemberLibraryStatus"];
  updateWorkoutExerciseResult: ComponentProps<typeof MemberPortal>["updateWorkoutExerciseResult"];
  replaceWorkoutExerciseGroup: ComponentProps<typeof MemberPortal>["replaceWorkoutExerciseGroup"];
  appendWorkoutSetForProgramExercise: ComponentProps<typeof MemberPortal>["appendWorkoutSetForProgramExercise"];
  deferWorkoutExerciseGroup: ComponentProps<typeof MemberPortal>["deferWorkoutExerciseGroup"];
  removeWorkoutLogResult: ComponentProps<typeof MemberPortal>["removeWorkoutLogResult"];
  setWorkoutLogResults: ComponentProps<typeof MemberPortal>["setWorkoutLogResults"];
  updateWorkoutModeNote: ComponentProps<typeof MemberPortal>["updateWorkoutModeNote"];
  updateWorkoutExerciseNote: ComponentProps<typeof MemberPortal>["updateWorkoutExerciseNote"];
  finishWorkoutMode: ComponentProps<typeof MemberPortal>["finishWorkoutMode"];
  logGroupWorkout: ComponentProps<typeof MemberPortal>["logGroupWorkout"];
  logIntervalWorkout: ComponentProps<typeof MemberPortal>["logIntervalWorkout"];
  logCompletedPlanEntry: ComponentProps<typeof MemberPortal>["logCompletedPlanEntry"];
  removeGroupWorkoutLog: ComponentProps<typeof MemberPortal>["removeGroupWorkoutLog"];
  removeCompletedPlanEntryLog: ComponentProps<typeof MemberPortal>["removeCompletedPlanEntryLog"];
  cancelWorkoutMode: ComponentProps<typeof MemberPortal>["cancelWorkoutMode"];
  dismissWorkoutMode: ComponentProps<typeof MemberPortal>["dismissWorkoutMode"];
  resumePausedWorkout: ComponentProps<typeof MemberPortal>["resumePausedWorkout"];
  discardPausedWorkoutDraft: ComponentProps<typeof MemberPortal>["discardPausedWorkoutDraft"];
  dismissWorkoutCelebration: ComponentProps<typeof MemberPortal>["dismissWorkoutCelebration"];
  memberNotificationsOpen: boolean;
  memberUnreadCount: number;
  memberVisibleAlerts: MemberAlert[];
  handleMemberBellToggle: () => void;
  openAlert: (alert: MemberAlert) => void;
  markMemberInspirationAsSeen: () => void;
  memberFocusInspirationItemId: string | null;
  clearMemberFocusInspirationItemId: () => void;
  memberFocusWorkoutLogId: string | null;
  clearMemberFocusWorkoutLogId: () => void;
  memberCheckInOverlayOpen: boolean;
  setMemberCheckInOverlayOpen: (open: boolean) => void;
  remoteMemberPeriodPlanRows: ComponentProps<typeof MemberPortal>["remoteMemberPeriodPlanRows"];
  refreshRemoteHydration?: ComponentProps<typeof MemberPortal>["refreshRemoteHydration"];
  onLogout: () => void;
};

export function MemberLayout({
  appState,
  patchState,
  memberTab,
  setMemberTab,
  updateMember,
  currentMemberAvatarUrl,
  setCurrentMemberAvatarUrl,
  sendMemberMessage,
  startWorkoutMode,
  startCustomWorkout,
  saveProgramForMember,
  deleteProgramById,
  updateProgramMemberLibraryStatus,
  updateWorkoutExerciseResult,
  replaceWorkoutExerciseGroup,
  appendWorkoutSetForProgramExercise,
  deferWorkoutExerciseGroup,
  removeWorkoutLogResult,
  setWorkoutLogResults,
  updateWorkoutModeNote,
  updateWorkoutExerciseNote,
  finishWorkoutMode,
  logGroupWorkout,
  logIntervalWorkout,
  logCompletedPlanEntry,
  removeGroupWorkoutLog,
  removeCompletedPlanEntryLog,
  cancelWorkoutMode,
  dismissWorkoutMode,
  resumePausedWorkout,
  discardPausedWorkoutDraft,
  dismissWorkoutCelebration,
  memberNotificationsOpen,
  memberUnreadCount,
  memberVisibleAlerts,
  handleMemberBellToggle,
  openAlert,
  markMemberInspirationAsSeen,
  memberFocusInspirationItemId,
  clearMemberFocusInspirationItemId,
  memberFocusWorkoutLogId,
  clearMemberFocusWorkoutLogId,
  memberCheckInOverlayOpen,
  setMemberCheckInOverlayOpen,
  remoteMemberPeriodPlanRows,
  refreshRemoteHydration,
  onLogout,
}: MemberLayoutProps) {
  const [onboardingGateOpen, setOnboardingGateOpen] = useState(false);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const memberAccessBlocked = useMemo(() => {
    const email = appState.currentUser?.email ?? "";
    if (!email) return false;
    return isMemberAppAccessBlocked(appState.members, email);
  }, [appState.currentUser?.email, appState.members]);
  const activeMember = useMemo(() => {
    const base = resolveActiveMemberForUser(appState);
    if (!base) return null;
    return enrichMemberWithBestProfile(base, appState.members);
  }, [appState]);
  const currentUserRole = appState.currentUser?.role;
  const onboardingIdentityKey = activeMember ? memberOnboardingIdentityKey(activeMember) : "";
  const onboardingCompleted = useMemo(
    () => isOnboardingCompleted(activeMember?.personalGoals),
    [activeMember?.personalGoals],
  );
  const needsOnboardingPrompt = useMemo(
    () => shouldShowMemberOnboarding(activeMember, currentUserRole, appState.members),
    [activeMember, currentUserRole, appState.members],
  );

  useEffect(() => {
    if (currentUserRole !== "member" || !activeMember || !onboardingIdentityKey) return;
    if (hasSeenMemberWelcome(onboardingIdentityKey)) return;
    setWelcomeModalOpen(true);
  }, [activeMember, currentUserRole, onboardingIdentityKey]);

  function dismissWelcomeModal() {
    if (!onboardingIdentityKey) return;
    markMemberWelcomeSeen(onboardingIdentityKey);
    markOnboardingGateSeen(onboardingIdentityKey);
    setWelcomeModalOpen(false);
  }

  function startOnboardingFromWelcome() {
    if (!onboardingIdentityKey) return;
    markMemberWelcomeSeen(onboardingIdentityKey);
    setWelcomeModalOpen(false);
    if (needsOnboardingPrompt) {
      setOnboardingGateOpen(true);
    }
  }

  function browseTipsFromWelcome() {
    dismissWelcomeModal();
    setMemberTab("inspiration");
  }

  useEffect(() => {
    if (memberTab === "inspiration") {
      markMemberInspirationAsSeen();
    }
  }, [memberTab, markMemberInspirationAsSeen]);

  async function persistOnboardingAnswers(answers: MemberOnboardingAnswers) {
    if (!activeMember) return;
    const loginEmail = appState.currentUser?.email.trim().toLowerCase() ?? "";
    const canonicalMember = pickCanonicalMemberRowForProfile(activeMember, appState.members);
    const personalGoals = mergeOnboardingIntoPersonalGoals(canonicalMember.personalGoals, answers);
    const focusSummary = answers.trainingGoals.slice(0, 3).join(" · ");
    const changes = {
      goal: primaryGoalFromOnboarding(answers),
      level: answers.level,
      injuries: answers.injuries.trim() || canonicalMember.injuries,
      personalGoals,
      focus: focusSummary || canonicalMember.focus,
    };
    const emailKey = loginEmail || canonicalMember.email.trim().toLowerCase();
    const targetMembers = emailKey
      ? appState.members.filter((member) => member.email.trim().toLowerCase() === emailKey)
      : findMembersByEmail(canonicalMember, appState.members);
    const targetIds = Array.from(new Set(targetMembers.map((member) => member.id.trim()).filter(Boolean)));

    let canonicalId = "";
    try {
      canonicalId = await persistOnboardingToSupabase(
        { ...canonicalMember, email: emailKey || canonicalMember.email },
        changes,
        targetIds,
      );
    } catch (error) {
      setOnboardingGateOpen(true);
      throw error;
    }

    if (loginEmail && canonicalId && !canonicalId.startsWith("auth-")) {
      await ensureMemberAuthLink(loginEmail, canonicalId);
    }

    patchState((prev) => {
      const members = prev.members
        .filter((member) => {
          if (!emailKey) return true;
          if (!member.id.startsWith("auth-")) return true;
          return member.email.trim().toLowerCase() !== emailKey;
        })
        .map((member) => {
          const samePerson =
            (canonicalId && member.id === canonicalId) ||
            targetIds.includes(member.id) ||
            (emailKey && member.email.trim().toLowerCase() === emailKey);
          return samePerson ? { ...member, ...changes } : member;
        });
      const viewId =
        canonicalId && !canonicalId.startsWith("auth-")
          ? canonicalId
          : members.find((m) => emailKey && m.email.trim().toLowerCase() === emailKey && !m.id.startsWith("auth-"))?.id ??
            prev.memberViewId;
      return {
        ...prev,
        members,
        memberViewId: viewId,
        selectedMemberId: viewId,
        currentUser: prev.currentUser
          ? {
              ...prev.currentUser,
              memberId: viewId.startsWith("auth-") ? prev.currentUser.memberId : viewId,
            }
          : prev.currentUser,
      };
    });
  }

  const checkInWindow = useMemo(() => resolveCheckInWindow(), []);

  async function persistMonthlyCheckInAnswers(answers: MemberMonthlyCheckInAnswers) {
    if (!activeMember) return;
    const personalGoals = mergeCheckInIntoPersonalGoals(activeMember.personalGoals, answers);
    updateMember({
      memberId: activeMember.id,
      changes: { personalGoals },
    });
    await waitForMemberPersist(activeMember.id);
    setMemberCheckInOverlayOpen(false);
  }

  const isMemberLimited = useMemo(() => {
    const currentUser = appState.currentUser;
    if (!currentUser) return false;
    const normalizedEmail = currentUser.email.trim().toLowerCase();
    const candidates = appState.members.filter((member) => {
      if (currentUser.memberId && member.id === currentUser.memberId) return true;
      if (appState.memberViewId && member.id === appState.memberViewId) return true;
      return Boolean(normalizedEmail && member.email.trim().toLowerCase() === normalizedEmail);
    });
    if (currentUser.role === "member") {
      return !candidates.some((member) => member.customerType === "PT-kunde" || member.membershipType === "Premium");
    }
    return candidates.some((member) => member.customerType === "Medlem" && member.membershipType !== "Premium");
  }, [appState.currentUser, appState.members, appState.memberViewId]);
  useEffect(() => {
    if (!isMemberLimited) return;
    if (memberTab === "messages" || memberTab === "progress") {
      setMemberTab("overview");
    }
  }, [isMemberLimited, memberTab, setMemberTab]);

  const memberPortalProps: ComponentProps<typeof MemberPortal> = {
    members: appState.members,
    currentUserRole: appState.currentUser!.role,
    currentUserEmail: appState.currentUser!.email,
    currentUserSupabaseId: appState.currentUser?.id,
    currentUserMemberId: appState.currentUser?.memberId,
    programs: appState.programs,
    logs: appState.logs,
    messages: appState.messages,
    memberViewId: appState.memberViewId,
    memberTab,
    setMemberTab,
    updateMember,
    memberAvatarUrl: currentMemberAvatarUrl,
    setMemberAvatarUrl: setCurrentMemberAvatarUrl,
    exercises: appState.exercises,
    sendMemberMessage,
    workoutMode: appState.workoutMode,
    startWorkoutMode,
    startCustomWorkout,
    saveProgramForMember,
    deleteProgramById,
    updateProgramMemberLibraryStatus,
    updateWorkoutExerciseResult,
    replaceWorkoutExerciseGroup,
    appendWorkoutSetForProgramExercise,
  deferWorkoutExerciseGroup,
    removeWorkoutLogResult,
    setWorkoutLogResults,
    updateWorkoutModeNote,
    updateWorkoutExerciseNote,
    finishWorkoutMode,
    logGroupWorkout,
    logCompletedPlanEntry,
    removeGroupWorkoutLog,
    removeCompletedPlanEntryLog,
    cancelWorkoutMode,
    dismissWorkoutMode,
    resumePausedWorkout,
    discardPausedWorkoutDraft,
    workoutCelebration: appState.workoutCelebration,
    dismissWorkoutCelebration,
    memberFocusWorkoutLogId,
    clearMemberFocusWorkoutLogId,
    remoteMemberPeriodPlanRows,
    refreshRemoteHydration,
    onOpenMonthlyCheckIn: () => setMemberCheckInOverlayOpen(true),
    onOpenOnboarding: () => setOnboardingGateOpen(true),
    showOnboardingHomePrompt: !welcomeModalOpen && !onboardingGateOpen && !onboardingCompleted,
    onboardingSubstantivelyComplete: onboardingCompleted,
  };
  const inspirationMemberId =
    appState.memberViewId ||
    appState.currentUser?.memberId ||
    appState.members.find((member) => member.email.trim().toLowerCase() === appState.currentUser?.email.trim().toLowerCase())?.id ||
    "";

  function addInspirationPeriodPlan(plan: PeriodSchedulePlan) {
    if (!inspirationMemberId || typeof window === "undefined") return;
    const byMember = readPeriodPlansByMemberId();
    const existing = byMember[inspirationMemberId] ?? [];
    const memberPlan = normalizePeriodSchedulePlan({
      ...plan,
      id: `${plan.id}-${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
      periodPlanAddedBy: "member",
    });
    byMember[inspirationMemberId] = [
      memberPlan,
      ...existing,
    ];
    writePeriodPlansByMemberId(byMember);
    void upsertMemberPeriodPlansForTrainer([inspirationMemberId], memberPlan).then(() => refreshRemoteHydration?.());
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("motus.member.openPeriodPlanOnPrograms", "1");
    }
    setMemberTab("programs");
  }

  if (memberAccessBlocked) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center shadow-sm ring-1 ring-black/5 sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Ingen tilgang</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{MEMBER_ARCHIVED_APP_MESSAGE}</p>
        <button
          type="button"
          onClick={() => onLogout()}
          className="mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
          style={{ background: MOTUS.gradient }}
        >
          Logg ut
        </button>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-5">
        {!isMemberLimited ? (
        <Card className="bg-gradient-to-br from-emerald-50/90 via-white to-pink-50/70 p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aktuelt nå</div>
              <div className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                {memberUnreadCount > 0 ? (
                  <>
                    <span>{memberUnreadCount} nytt</span>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: MOTUS.pink }} />
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Alt er ajour</span>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleMemberBellToggle}
              className="relative inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-emerald-50"
              style={{ borderColor: "rgba(20,184,166,0.25)" }}
              aria-label={memberNotificationsOpen ? "Lukk varsler" : "Åpne varsler"}
            >
              <Bell className="h-4 w-4" />
              <span>{memberNotificationsOpen ? "Lukk" : "Se"}</span>
              {memberUnreadCount > 0 ? (
                <span
                  className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                  style={{ backgroundColor: MOTUS.pink }}
                >
                  {memberUnreadCount}
                </span>
              ) : null}
            </button>
          </div>
          {memberNotificationsOpen ? (
            <div className="mt-3 max-h-[min(22rem,70vh)] overflow-y-auto space-y-2 pr-1">
              {memberVisibleAlerts.map((alert) => {
                const AlertIcon =
                  alert.kind === "message"
                    ? MessageSquare
                    : alert.kind === "workout-comment"
                      ? TrendingUp
                      : alert.kind === "inspiration"
                        ? Sparkles
                        : alert.kind === "check-in"
                          ? ClipboardPenLine
                          : ClipboardList;
                const isUnread = alert.isUnread;
                const isOpened = alert.isOpened && !isUnread;
                const isRead = !isUnread;
                const receivedAt = formatNotificationTimestamp(alert.timestamp);
                return (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => openAlert(alert)}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left shadow-sm transition ${
                      isOpened
                        ? "border-slate-200/80 bg-slate-50/90 opacity-75 hover:bg-slate-100"
                        : isUnread
                          ? "border-pink-200/90 bg-pink-50/40 hover:-translate-y-0.5 hover:bg-pink-50/70"
                          : isRead
                            ? "border-slate-200/90 bg-slate-50/70 opacity-90 hover:bg-slate-100"
                            : "border-emerald-200/80 bg-white hover:-translate-y-0.5 hover:bg-emerald-50"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        isUnread
                          ? "bg-pink-100 text-pink-700"
                          : isOpened || isRead
                            ? "bg-slate-100 text-slate-400"
                            : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      <AlertIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={`block text-sm ${
                            isOpened
                              ? "font-medium text-slate-500"
                              : isUnread
                                ? "font-semibold text-slate-900"
                                : isRead
                                  ? "font-medium text-slate-600"
                                  : "font-semibold text-slate-800"
                          }`}
                        >
                          {alert.title}
                        </span>
                        {isUnread ? (
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                            style={{ backgroundColor: MOTUS.pink }}
                          >
                            Ny
                          </span>
                        ) : null}
                      </span>
                      <span className={`block truncate text-xs ${isOpened ? "text-slate-400" : "text-slate-500"}`}>
                        {alert.detail}
                      </span>
                      {receivedAt ? (
                        <span className={`mt-0.5 block text-[11px] ${isUnread ? "font-medium text-pink-700/80" : "text-slate-400"}`}>
                          {receivedAt}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 transition ${
                        isOpened ? "text-slate-300" : "text-slate-300 group-hover:text-emerald-500"
                      }`}
                    />
                  </button>
                );
              })}
              {memberVisibleAlerts.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-white px-3 py-2.5 text-sm text-slate-500">
                  Ingen nye ting å følge opp akkurat nå.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 text-xs sm:text-sm text-slate-500">
              {memberUnreadCount > 0
                ? "Åpne for å gå rett til melding, program eller inspo."
                : "Nye meldinger, programmer og inspirasjon dukker opp her."}
            </div>
          )}
        </Card>
        ) : null}
        <MemberDesktopTabNav memberTab={memberTab} setMemberTab={setMemberTab} isMemberLimited={isMemberLimited} />
        <div className="pb-24 lg:pb-0">
        {memberTab === "inspiration" ? (
          <InspirationHub
            memberId={inspirationMemberId}
            memberName={appState.currentUser?.name ?? "Medlem"}
            exerciseBank={appState.exercises}
            focusItemId={memberFocusInspirationItemId}
            onFocusItemHandled={clearMemberFocusInspirationItemId}
            onAddProgram={(program) => {
              if (!inspirationMemberId) return;
              saveProgramForMember({ ...program, memberId: inspirationMemberId, programCreatedBy: "member", programCreatedByName: appState.currentUser?.name ?? "Medlem" });
              setMemberTab("programs");
            }}
            onAddPeriodPlan={addInspirationPeriodPlan}
          />
        ) : (
          <MemberPortal {...memberPortalProps} />
        )}
      </div>

      {!welcomeModalOpen && !onboardingGateOpen && !memberCheckInOverlayOpen ? (
        <MemberMobileTabNav memberTab={memberTab} setMemberTab={setMemberTab} isMemberLimited={isMemberLimited} />
      ) : null}

      {welcomeModalOpen && activeMember ? (
        <MemberWelcomeModal
          memberName={activeMember.name}
          needsOnboarding={needsOnboardingPrompt}
          onStartOnboarding={startOnboardingFromWelcome}
          onBrowseTips={browseTipsFromWelcome}
          onDismiss={dismissWelcomeModal}
        />
      ) : null}

      {onboardingGateOpen && activeMember ? (
        <MemberOnboarding
          memberName={activeMember.name}
          initialDraft={onboardingDraftFromStored(activeMember.personalGoals)}
          onComplete={persistOnboardingAnswers}
          onClose={() => {
            setOnboardingGateOpen(false);
            void refreshRemoteHydration?.();
          }}
        />
      ) : null}

      {memberCheckInOverlayOpen && activeMember && checkInWindow ? (
        <MemberMonthlyCheckIn
          memberName={activeMember.name}
          window={checkInWindow}
          onComplete={persistMonthlyCheckInAnswers}
          onClose={() => setMemberCheckInOverlayOpen(false)}
        />
      ) : null}
      </div>
    </>
  );
}

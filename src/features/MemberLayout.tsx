import { useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { MOTUS } from "../app/data";
import {
  enrichMemberWithBestProfile,
  findMembersByEmail,
  hasSeenMemberWelcome,
  isMemberOnboardingComplete,
  isMemberOnboardingSubmitted,
  markOnboardingCompleteLocally,
  markOnboardingGateSeen,
  markMemberWelcomeSeen,
  memberOnboardingIdentityKey,
  mergeOnboardingIntoPersonalGoals,
  onboardingAnswersAreSubstantive,
  onboardingDraftFromStored,
  pickCanonicalMemberRowForProfile,
  primaryGoalFromOnboarding,
  resolveMemberPersonalGoals,
  resolveMemberOnboarding,
  shouldShowMemberOnboarding,
  type MemberOnboardingAnswers,
} from "../app/memberOnboarding";
import { normalizePeriodSchedulePlan, readPeriodPlansByMemberId, writePeriodPlansByMemberId } from "../app/periodPlanMerge";
import type { AppState, Member, MemberTab, PeriodSchedulePlan } from "../app/types";
import { applyInviteStampToMembersByEmail } from "../app/memberInviteStatus";
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
import { MemberHomeHeaderActions } from "./MemberHomeHeaderActions";
import { MemberNotificationsPanel } from "./MemberNotificationsPanel";

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
  toggleChatMessageReaction: ComponentProps<typeof MemberPortal>["toggleChatMessageReaction"];
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
  resumePausedWorkout: (draftId: string, memberIdHint?: string) => void;
  discardPausedWorkoutDraft: ComponentProps<typeof MemberPortal>["discardPausedWorkoutDraft"];
  dismissWorkoutCelebration: ComponentProps<typeof MemberPortal>["dismissWorkoutCelebration"];
  recentlyFinishedLogId: ComponentProps<typeof MemberPortal>["recentlyFinishedLogId"];
  dismissRecentlyFinishedLog: ComponentProps<typeof MemberPortal>["dismissRecentlyFinishedLog"];
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
  memberFocusProgramId: string | null;
  clearMemberFocusProgramId: () => void;
  memberCheckInOverlayOpen: boolean;
  setMemberCheckInOverlayOpen: (open: boolean) => void;
  remoteMemberPeriodPlanRows: ComponentProps<typeof MemberPortal>["remoteMemberPeriodPlanRows"];
  memberRemoteHydrated?: ComponentProps<typeof MemberPortal>["memberRemoteHydrated"];
  isLocalDemoSession?: ComponentProps<typeof MemberPortal>["isLocalDemoSession"];
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
  toggleChatMessageReaction,
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
  recentlyFinishedLogId,
  dismissRecentlyFinishedLog,
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
  memberFocusProgramId,
  clearMemberFocusProgramId,
  memberCheckInOverlayOpen,
  setMemberCheckInOverlayOpen,
  remoteMemberPeriodPlanRows,
  memberRemoteHydrated = false,
  isLocalDemoSession = false,
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
    () => isMemberOnboardingComplete(activeMember, appState.members),
    [activeMember, appState.members],
  );
  const onboardingSubmitted = useMemo(
    () => isMemberOnboardingSubmitted(activeMember, appState.members),
    [activeMember, appState.members],
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

  useEffect(() => {
    if (!activeMember || !onboardingIdentityKey) return;
    const resolved = resolveMemberOnboarding(activeMember, appState.members);
    if (resolved?.completedAt && onboardingAnswersAreSubstantive(resolved)) {
      markOnboardingCompleteLocally(onboardingIdentityKey, resolved.completedAt);
      return;
    }
    // Seed lokalflagg ogs\u00e5 n\u00e5r vi bare ser at skjemaet er innsendt (uten substantielle svar).
    // Da slipper kunden \u00e5 se prompten p\u00e5 hjem hvis dataene ble lagret f\u00f8r/skipped p\u00e5 en annen enhet.
    if (onboardingSubmitted) {
      markOnboardingCompleteLocally(
        onboardingIdentityKey,
        resolved?.completedAt?.trim() || new Date().toISOString(),
      );
    }
  }, [activeMember, appState.members, onboardingIdentityKey, onboardingSubmitted]);

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
      const linkResult = await ensureMemberAuthLink(loginEmail, canonicalId);
      if (linkResult.invitedAt || linkResult.invitedRowsStamped) {
        patchState((prev) =>
          applyInviteStampToMembersByEmail(prev, loginEmail, linkResult.invitedAt ?? new Date().toISOString()),
        );
      }
    }
    if (onboardingIdentityKey) {
      markOnboardingGateSeen(onboardingIdentityKey);
      markOnboardingCompleteLocally(onboardingIdentityKey, answers.completedAt);
    }
    setOnboardingGateOpen(false);

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
      return !candidates.some(
        (member) => member.customerType !== "Medlem" || member.membershipType === "Premium",
      );
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
    toggleChatMessageReaction,
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
    logIntervalWorkout,
    logCompletedPlanEntry,
    removeGroupWorkoutLog,
    removeCompletedPlanEntryLog,
    cancelWorkoutMode,
    dismissWorkoutMode,
    resumePausedWorkout,
    discardPausedWorkoutDraft,
    workoutCelebration: appState.workoutCelebration,
    dismissWorkoutCelebration,
    recentlyFinishedLogId,
    dismissRecentlyFinishedLog,
    memberFocusWorkoutLogId,
    clearMemberFocusWorkoutLogId,
    memberFocusProgramId,
    clearMemberFocusProgramId,
    remoteMemberPeriodPlanRows,
    memberRemoteHydrated,
    isLocalDemoSession,
    refreshRemoteHydration,
    onOpenMonthlyCheckIn: () => setMemberCheckInOverlayOpen(true),
    onOpenOnboarding: () => setOnboardingGateOpen(true),
    showOnboardingHomePrompt: !welcomeModalOpen && !onboardingGateOpen && !onboardingSubmitted,
    onboardingSubstantivelyComplete: onboardingCompleted,
    homeOverviewHeaderActions: (
      <MemberHomeHeaderActions
        showNotifications={!isMemberLimited}
        memberUnreadCount={memberUnreadCount}
        memberNotificationsOpen={memberNotificationsOpen}
        onMemberBellToggle={handleMemberBellToggle}
        onLogout={onLogout}
      />
    ),
    homeOverviewNotificationsPanel:
      !isMemberLimited && memberNotificationsOpen ? (
        <MemberNotificationsPanel alerts={memberVisibleAlerts} onOpenAlert={openAlert} />
      ) : null,
  };
  const inspirationMemberId =
    activeMember?.id ||
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
    void upsertMemberPeriodPlansForTrainer([inspirationMemberId], memberPlan, {
      targetEmail: appState.currentUser?.email,
    }).then((result) => {
      if (result.ok) refreshRemoteHydration?.();
    });
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
          initialDraft={onboardingDraftFromStored(resolveMemberPersonalGoals(activeMember, appState.members))}
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

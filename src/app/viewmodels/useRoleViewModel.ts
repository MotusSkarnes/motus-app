import { useCallback, useMemo, useState, type ComponentProps } from "react";
import { isTrainerMemberPreview, resolveLayoutRole } from "../resolveLayoutRole";
import { enrichMemberWithBestProfile } from "../memberOnboarding";
import { resolveMemberTrainerDisplayName } from "../trainerProfile";
import {
  mergeMemberNotificationPreferencesIntoPersonalGoals,
  type MemberNotificationPreferences,
} from "../notificationPreferences";
import { AppHeader, MemberLayout, TrainerLayout } from "../../features";
import { buildAppHeaderProps, buildMemberLayoutProps, buildTrainerLayoutProps } from "./viewModelBuilders";
import type { AppStateHookResult, RoleViewModel } from "./types";
import { useMemberAvatarStore } from "../useMemberAvatarStore";
import { useNotifications } from "../useNotifications";

export function useRoleViewModel(state: AppStateHookResult): RoleViewModel {
  function handleResetData() {
    const shouldReset = window.confirm("Dette nullstiller alle testdata i appen. Er du sikker?");
    if (!shouldReset) return;
    state.resetAllData();
  }

  const [openCustomerMessagesSignal, setOpenCustomerMessagesSignal] = useState(0);
  const [openCustomerOverviewSignal, setOpenCustomerOverviewSignal] = useState(0);
  const { memberAvatarById, currentMemberAvatarUrl, setMemberAvatarUrlForMember, setCurrentMemberAvatarUrl } =
    useMemberAvatarStore({
      currentUser: state.appState.currentUser,
      members: state.appState.members,
      memberViewId: state.appState.memberViewId,
    });

  const memberForNotificationSync = useMemo(() => {
    if (state.appState.currentUser?.role !== "member") return null;
    const viewId = state.appState.memberViewId.trim();
    const email = state.appState.currentUser?.email?.trim().toLowerCase() ?? "";
    const match =
      (viewId ? state.appState.members.find((member) => member.id === viewId) : null) ??
      (email ? state.appState.members.find((member) => member.email.trim().toLowerCase() === email) : null);
    if (!match) return null;
    return enrichMemberWithBestProfile(match, state.appState.members);
  }, [
    state.appState.currentUser?.role,
    state.appState.currentUser?.email,
    state.appState.memberViewId,
    state.appState.members,
  ]);

  const onPersistMemberNotificationPreferences = useCallback(
    (preferences: MemberNotificationPreferences) => {
      const member = memberForNotificationSync;
      if (!member) return;
      const encoded = mergeMemberNotificationPreferencesIntoPersonalGoals(member.personalGoals, preferences);
      state.updateMember({
        memberId: member.id,
        changes: { personalGoals: encoded },
      });
    },
    [memberForNotificationSync, state.updateMember],
  );

  const {
    trainerNotificationsOpen,
    setTrainerNotificationsOpen,
    memberNotificationsOpen,
    trainerVisibleAlerts,
    memberVisibleAlerts,
    trainerUnreadCount,
    memberUnreadCount,
    handleTrainerBellToggle,
    handleMemberBellToggle,
    openTrainerAlert,
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
  } = useNotifications({
    messages: state.appState.messages,
    programs: state.appState.programs,
    logs: state.appState.logs,
    members: state.appState.members,
    memberViewId: state.appState.memberViewId,
    remoteMemberPeriodPlanRows: state.remoteMemberPeriodPlanRows,
    memberPersonalGoals: memberForNotificationSync?.personalGoals,
    memberNotificationProfileReady: Boolean(memberForNotificationSync),
    currentUserRole: state.appState.currentUser?.role,
    setMemberTab: state.setMemberTab,
    onPersistMemberNotificationPreferences,
    onTrainerOpenMessage: (memberId) => {
      state.patchState({ selectedMemberId: memberId });
      state.setTrainerTab("customers");
      setOpenCustomerMessagesSignal((prev) => prev + 1);
    },
    onTrainerOpenCustomers: () => {
      state.setTrainerTab("customers");
    },
    onTrainerOpenMemberForm: (memberId) => {
      state.patchState({ selectedMemberId: memberId });
      state.setTrainerTab("customers");
      setOpenCustomerOverviewSignal((prev) => prev + 1);
    },
  });

  const activeMemberForHeader = useMemo(() => {
    const currentUser = state.appState.currentUser;
    if (!currentUser || currentUser.role !== "member") return null;
    const normalizedEmail = currentUser.email.trim().toLowerCase();
    const currentMemberId = currentUser.memberId?.trim() ?? "";
    const viewMemberId = state.appState.memberViewId.trim();
    const selectedMemberId = state.appState.selectedMemberId.trim();
    return (
      (currentMemberId ? state.appState.members.find((member) => member.id === currentMemberId) : null) ??
      (viewMemberId ? state.appState.members.find((member) => member.id === viewMemberId) : null) ??
      (selectedMemberId ? state.appState.members.find((member) => member.id === selectedMemberId) : null) ??
      (normalizedEmail
        ? state.appState.members.find((member) => member.email.trim().toLowerCase() === normalizedEmail)
        : null) ??
      null
    );
  }, [
    state.appState.currentUser,
    state.appState.memberViewId,
    state.appState.members,
    state.appState.selectedMemberId,
  ]);

  const memberHeaderDisplayName = useMemo(() => {
    const name = activeMemberForHeader?.name.trim() ?? "";
    return name || undefined;
  }, [activeMemberForHeader]);

  const memberTrainerDisplayName = useMemo(() => {
    const member = activeMemberForHeader;
    if (!member) return undefined;
    return resolveMemberTrainerDisplayName(member, state.appState.programs);
  }, [activeMemberForHeader, state.appState.programs]);

  const layoutRole = resolveLayoutRole(state.appState);
  const trainerMemberPreview = isTrainerMemberPreview(state.appState);

  const isMemberLimited = useMemo(() => {
    const currentUser = state.appState.currentUser;
    if (!currentUser) return false;
    const normalizedEmail = currentUser.email.trim().toLowerCase();
    const candidates = state.appState.members.filter((member) => {
      if (currentUser.memberId && member.id === currentUser.memberId) return true;
      if (state.appState.memberViewId && member.id === state.appState.memberViewId) return true;
      return Boolean(normalizedEmail && member.email.trim().toLowerCase() === normalizedEmail);
    });
    if (currentUser.role === "member") {
      return !candidates.some(
        (member) => member.customerType !== "Medlem" || member.membershipType === "Premium",
      );
    }
    return candidates.some((member) => member.customerType === "Medlem" && member.membershipType !== "Premium");
  }, [state.appState.currentUser, state.appState.members, state.appState.memberViewId]);

  const appHeaderProps: ComponentProps<typeof AppHeader> = buildAppHeaderProps({
    currentUser: state.appState.currentUser!,
    memberDisplayName: memberHeaderDisplayName,
    memberTrainerDisplayName,
    role: layoutRole,
    memberTab: state.memberTab,
    showQuickLogin: state.showQuickLogin,
    onSwitchRole: (role) => state.patchState({ role }),
    showTrainerMemberPreviewBar: trainerMemberPreview,
    onExitTrainerMemberPreview: trainerMemberPreview ? () => state.patchState({ role: "trainer" }) : undefined,
    onResetData: handleResetData,
    onLogout: state.handleLogout,
    memberUnreadCount,
    memberNotificationsOpen,
    memberVisibleAlerts,
    onMemberBellToggle: handleMemberBellToggle,
    onOpenMemberAlert: openAlert,
    showMemberNotifications: layoutRole === "member" && !isMemberLimited,
    trainerUnreadCount,
    trainerNotificationsOpen,
    trainerVisibleAlerts,
    onTrainerBellToggle: handleTrainerBellToggle,
    onOpenTrainerAlert: openTrainerAlert,
    showTrainerNotifications: layoutRole === "trainer",
  });

  const trainerLayoutProps: ComponentProps<typeof TrainerLayout> = buildTrainerLayoutProps({
    appState: state.appState,
    trainerTab: state.trainerTab,
    setTrainerTab: state.setTrainerTab,
    patchState: state.patchState,
    messageBadgeCount: trainerUnreadCount,
    addMember: state.addMember,
    deactivateMember: state.deactivateMember,
    deleteMember: state.deleteMember,
    updateMember: state.updateMember,
    markMemberInvited: state.markMemberInvited,
    inviteMember: state.inviteMember,
    inviteTrainer: state.inviteTrainer,
    restoreMemberByEmail: state.restoreMemberByEmail,
    reassignMemberOwner: state.reassignMemberOwner,
    restoreMissingTestData: state.restoreMissingTestData,
    restoreOriginalExerciseBank: state.restoreOriginalExerciseBank,
    saveProgramForMember: state.saveProgramForMember,
    deleteProgramById: state.deleteProgramById,
    sendTrainerMessage: state.sendTrainerMessage,
    toggleChatMessageReaction: state.toggleChatMessageReaction,
    updateWorkoutLogTrainerComment: state.updateWorkoutLogTrainerComment,
    clearLocalChatCache: state.clearLocalChatCache,
    saveExercise: state.saveExercise,
    deleteExercise: state.deleteExercise,
    openCustomerMessagesSignal,
    setOpenCustomerMessagesSignal,
    openCustomerOverviewSignal,
    setOpenCustomerOverviewSignal,
    memberAvatarById,
    setMemberAvatarUrlForMember,
    isLocalDemoSession: state.isLocalDemoSession,
    remoteTrainerPeriodPlansByMemberId: state.remoteTrainerPeriodPlansByMemberId,
    applyTrainerProfileSaved: state.applyTrainerProfileSaved,
    workoutMode: state.appState.workoutMode,
    startWorkoutMode: state.startWorkoutMode,
    updateWorkoutExerciseResult: state.updateWorkoutExerciseResult,
    replaceWorkoutExerciseGroup: state.replaceWorkoutExerciseGroup,
    appendWorkoutSetForProgramExercise: state.appendWorkoutSetForProgramExercise,
    deferWorkoutExerciseGroup: state.deferWorkoutExerciseGroup,
    updateWorkoutModeNote: state.updateWorkoutModeNote,
    updateWorkoutExerciseNote: state.updateWorkoutExerciseNote,
    finishWorkoutMode: state.finishWorkoutMode,
    cancelWorkoutMode: state.cancelWorkoutMode,
  });

  const memberLayoutProps: ComponentProps<typeof MemberLayout> = buildMemberLayoutProps({
    appState: state.appState,
    patchState: state.patchState,
    memberTab: state.memberTab,
    setMemberTab: state.setMemberTab,
    updateMember: state.updateMember,
    currentMemberAvatarUrl,
    setCurrentMemberAvatarUrl,
    sendMemberMessage: state.sendMemberMessage,
    toggleChatMessageReaction: state.toggleChatMessageReaction,
    startWorkoutMode: state.startWorkoutMode,
    startCustomWorkout: state.startCustomWorkout,
    saveProgramForMember: state.saveProgramForMember,
    deleteProgramById: state.deleteProgramById,
    updateProgramMemberLibraryStatus: state.updateProgramMemberLibraryStatus,
    updateWorkoutExerciseResult: state.updateWorkoutExerciseResult,
    replaceWorkoutExerciseGroup: state.replaceWorkoutExerciseGroup,
    appendWorkoutSetForProgramExercise: state.appendWorkoutSetForProgramExercise,
    deferWorkoutExerciseGroup: state.deferWorkoutExerciseGroup,
    removeWorkoutLogResult: state.removeWorkoutLogResult,
    setWorkoutLogResults: state.setWorkoutLogResults,
    updateWorkoutModeNote: state.updateWorkoutModeNote,
    updateWorkoutExerciseNote: state.updateWorkoutExerciseNote,
    finishWorkoutMode: state.finishWorkoutMode,
    logGroupWorkout: state.logGroupWorkout,
    logIntervalWorkout: state.logIntervalWorkout,
    logCompletedPlanEntry: state.logCompletedPlanEntry,
    removeGroupWorkoutLog: state.removeGroupWorkoutLog,
    removeCompletedPlanEntryLog: state.removeCompletedPlanEntryLog,
    cancelWorkoutMode: state.cancelWorkoutMode,
    dismissWorkoutMode: state.dismissWorkoutMode,
    resumePausedWorkout: state.resumePausedWorkout,
    discardPausedWorkoutDraft: state.discardPausedWorkoutDraft,
    dismissWorkoutCelebration: state.dismissWorkoutCelebration,
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
    remoteMemberPeriodPlanRows: state.remoteMemberPeriodPlanRows,
    memberRemoteHydrated: state.memberRemoteHydrated,
    isLocalDemoSession: state.isLocalDemoSession,
    refreshRemoteHydration: state.refreshRemoteHydration,
    onLogout: state.handleLogout,
  });

  return {
    appHeaderProps,
    trainerLayoutProps,
    memberLayoutProps,
  };
}

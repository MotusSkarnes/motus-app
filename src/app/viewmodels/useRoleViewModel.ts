import { useCallback, useMemo, useState, type ComponentProps } from "react";
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
    if (!viewId) return null;
    return state.appState.members.find((member) => member.id === viewId) ?? null;
  }, [state.appState.currentUser?.role, state.appState.memberViewId, state.appState.members]);

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
    memberCheckInOverlayOpen,
    setMemberCheckInOverlayOpen,
  } = useNotifications({
    messages: state.appState.messages,
    programs: state.appState.programs,
    logs: state.appState.logs,
    members: state.appState.members,
    memberViewId: state.appState.memberViewId,
    memberPersonalGoals: memberForNotificationSync?.personalGoals,
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

  const memberHeaderDisplayName = useMemo(() => {
    const currentUser = state.appState.currentUser;
    if (!currentUser || currentUser.role !== "member") return undefined;
    const normalizedEmail = currentUser.email.trim().toLowerCase();
    const currentMemberId = currentUser.memberId?.trim() ?? "";
    const viewMemberId = state.appState.memberViewId.trim();
    const selectedMemberId = state.appState.selectedMemberId.trim();
    const match =
      (currentMemberId ? state.appState.members.find((member) => member.id === currentMemberId) : null) ??
      (viewMemberId ? state.appState.members.find((member) => member.id === viewMemberId) : null) ??
      (selectedMemberId ? state.appState.members.find((member) => member.id === selectedMemberId) : null) ??
      (normalizedEmail
        ? state.appState.members.find((member) => member.email.trim().toLowerCase() === normalizedEmail)
        : null) ??
      null;
    const name = match?.name.trim() ?? "";
    return name || undefined;
  }, [
    state.appState.currentUser,
    state.appState.memberViewId,
    state.appState.members,
    state.appState.selectedMemberId,
  ]);

  const layoutRole = state.appState.currentUser?.role ?? state.appState.role;

  const appHeaderProps: ComponentProps<typeof AppHeader> = buildAppHeaderProps({
    currentUser: state.appState.currentUser!,
    memberDisplayName: memberHeaderDisplayName,
    role: layoutRole,
    showQuickLogin: state.showQuickLogin,
    onSwitchRole: (role) => state.patchState({ role }),
    onResetData: handleResetData,
    onLogout: state.handleLogout,
    onOpenMemberProfile: () => state.setMemberTab("profile"),
  });

  const trainerLayoutProps: ComponentProps<typeof TrainerLayout> = buildTrainerLayoutProps({
    appState: state.appState,
    trainerTab: state.trainerTab,
    setTrainerTab: state.setTrainerTab,
    patchState: state.patchState,
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
    trainerNotificationsOpen,
    setTrainerNotificationsOpen,
    trainerUnreadCount,
    trainerVisibleAlerts,
    openTrainerAlert,
    handleTrainerBellToggle,
    isLocalDemoSession: state.isLocalDemoSession,
    remoteTrainerPeriodPlansByMemberId: state.remoteTrainerPeriodPlansByMemberId,
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
    memberCheckInOverlayOpen,
    setMemberCheckInOverlayOpen,
    remoteMemberPeriodPlanRows: state.remoteMemberPeriodPlanRows,
    refreshRemoteHydration: state.refreshRemoteHydration,
    onLogout: state.handleLogout,
  });

  return {
    appHeaderProps,
    trainerLayoutProps,
    memberLayoutProps,
  };
}

import { useState, type ComponentProps } from "react";
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
  const { memberAvatarById, currentMemberAvatarUrl, setMemberAvatarUrlForMember, setCurrentMemberAvatarUrl } =
    useMemberAvatarStore({
      currentUser: state.appState.currentUser,
      members: state.appState.members,
      memberViewId: state.appState.memberViewId,
    });

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
  } = useNotifications({
    messages: state.appState.messages,
    programs: state.appState.programs,
    logs: state.appState.logs,
    members: state.appState.members,
    memberViewId: state.appState.memberViewId,
    setMemberTab: state.setMemberTab,
    onTrainerOpenMessage: (memberId) => {
      state.patchState({ selectedMemberId: memberId });
      state.setTrainerTab("customers");
      setOpenCustomerMessagesSignal((prev) => prev + 1);
    },
    onTrainerOpenCustomers: () => {
      state.setTrainerTab("customers");
    },
  });

  const appHeaderProps: ComponentProps<typeof AppHeader> = buildAppHeaderProps({
    currentUser: state.appState.currentUser!,
    role: state.appState.role,
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
    updateWorkoutModeNote: state.updateWorkoutModeNote,
    finishWorkoutMode: state.finishWorkoutMode,
    cancelWorkoutMode: state.cancelWorkoutMode,
  });

  const memberLayoutProps: ComponentProps<typeof MemberLayout> = buildMemberLayoutProps({
    appState: state.appState,
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
    removeWorkoutLogResult: state.removeWorkoutLogResult,
    setWorkoutLogResults: state.setWorkoutLogResults,
    updateWorkoutModeNote: state.updateWorkoutModeNote,
    finishWorkoutMode: state.finishWorkoutMode,
    logGroupWorkout: state.logGroupWorkout,
    logCompletedPlanEntry: state.logCompletedPlanEntry,
    removeGroupWorkoutLog: state.removeGroupWorkoutLog,
    removeCompletedPlanEntryLog: state.removeCompletedPlanEntryLog,
    cancelWorkoutMode: state.cancelWorkoutMode,
    dismissWorkoutCelebration: state.dismissWorkoutCelebration,
    memberNotificationsOpen,
    memberUnreadCount,
    memberVisibleAlerts,
    handleMemberBellToggle,
    openAlert,
    remoteMemberPeriodPlanRows: state.remoteMemberPeriodPlanRows,
    refreshRemoteHydration: state.refreshRemoteHydration,
  });

  return {
    appHeaderProps,
    trainerLayoutProps,
    memberLayoutProps,
  };
}

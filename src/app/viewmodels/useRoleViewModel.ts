import { useState, type ComponentProps } from "react";
import { AppHeader } from "../../features/AppHeader";
import { MemberLayout } from "../../features/MemberLayout";
import { TrainerLayout } from "../../features/TrainerLayout";
import { buildAppHeaderProps, buildMemberLayoutProps, buildTrainerLayoutProps } from "./viewModelBuilders";
import type { AppStateHookResult } from "./types";
import { useMemberAvatarStore } from "../useMemberAvatarStore";
import { useNotifications } from "../useNotifications";

export function useRoleViewModel(state: AppStateHookResult) {
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
    trainerMessageAlerts,
    memberVisibleAlerts,
    trainerUnreadCount,
    memberUnreadCount,
    handleTrainerBellToggle,
    handleMemberBellToggle,
    openAlert,
  } = useNotifications({
    messages: state.appState.messages,
    programs: state.appState.programs,
    members: state.appState.members,
    memberViewId: state.appState.memberViewId,
    setMemberTab: state.setMemberTab,
  });

  const appHeaderProps: ComponentProps<typeof AppHeader> = buildAppHeaderProps({
    currentUser: state.appState.currentUser!,
    role: state.appState.role,
    showQuickLogin: state.showQuickLogin,
    onSwitchRole: (role) => state.patchState({ role }),
    onResetData: handleResetData,
    onLogout: state.handleLogout,
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
    saveExercise: state.saveExercise,
    openCustomerMessagesSignal,
    setOpenCustomerMessagesSignal,
    memberAvatarById,
    setMemberAvatarUrlForMember,
    trainerNotificationsOpen,
    setTrainerNotificationsOpen,
    trainerUnreadCount,
    trainerMessageAlerts,
    handleTrainerBellToggle,
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
    updateWorkoutExerciseResult: state.updateWorkoutExerciseResult,
    replaceWorkoutExerciseGroup: state.replaceWorkoutExerciseGroup,
    updateWorkoutModeNote: state.updateWorkoutModeNote,
    finishWorkoutMode: state.finishWorkoutMode,
    cancelWorkoutMode: state.cancelWorkoutMode,
    dismissWorkoutCelebration: state.dismissWorkoutCelebration,
    memberNotificationsOpen,
    memberUnreadCount,
    memberVisibleAlerts,
    handleMemberBellToggle,
    openAlert,
  });

  return {
    appHeaderProps,
    trainerLayoutProps,
    memberLayoutProps,
  };
}

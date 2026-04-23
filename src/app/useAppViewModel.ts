import { useState, type ComponentProps } from "react";
import { AppHeader } from "../features/AppHeader";
import { LoginScreen } from "../features/LoginScreen";
import { MemberLayout } from "../features/MemberLayout";
import { TrainerLayout } from "../features/TrainerLayout";
import { useAppState } from "./useAppState";
import { useMemberAvatarStore } from "./useMemberAvatarStore";
import { useNotifications } from "./useNotifications";

export function useAppViewModel() {
  const {
    appState,
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    loginError,
    isRecoveryMode,
    recoveryPassword,
    setRecoveryPassword,
    recoveryPasswordConfirm,
    setRecoveryPasswordConfirm,
    recoveryError,
    recoveryInfo,
    passwordRecoveryInfo,
    passwordRecoveryError,
    passwordRecoveryCooldownSeconds,
    otpCode,
    setOtpCode,
    otpInfo,
    otpError,
    trainerTab,
    setTrainerTab,
    memberTab,
    setMemberTab,
    patchState,
    handleLogin,
    handleQuickLogin,
    completePasswordRecovery,
    sendPasswordRecoveryEmail,
    sendEmailOtpCode,
    loginWithEmailOtpCode,
    showQuickLogin,
    handleLogout,
    resetAllData,
    addMember,
    deactivateMember,
    deleteMember,
    updateMember,
    markMemberInvited,
    saveProgramForMember,
    deleteProgramById,
    sendTrainerMessage,
    saveExercise,
    startWorkoutMode,
    updateWorkoutExerciseResult,
    replaceWorkoutExerciseGroup,
    updateWorkoutModeNote,
    finishWorkoutMode,
    cancelWorkoutMode,
    dismissWorkoutCelebration,
    sendMemberMessage,
    inviteMember,
    inviteTrainer,
    restoreMemberByEmail,
    restoreMissingTestData,
    restoreOriginalExerciseBank,
  } = useAppState();

  function handleResetData() {
    const shouldReset = window.confirm("Dette nullstiller alle testdata i appen. Er du sikker?");
    if (!shouldReset) return;
    resetAllData();
  }

  const [openCustomerMessagesSignal, setOpenCustomerMessagesSignal] = useState(0);
  const { memberAvatarById, currentMemberAvatarUrl, setMemberAvatarUrlForMember, setCurrentMemberAvatarUrl } =
    useMemberAvatarStore({
      currentUser: appState.currentUser,
      members: appState.members,
      memberViewId: appState.memberViewId,
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
    messages: appState.messages,
    programs: appState.programs,
    members: appState.members,
    memberViewId: appState.memberViewId,
    setMemberTab,
  });

  const loginScreenProps: ComponentProps<typeof LoginScreen> = {
    email: loginEmail,
    setEmail: setLoginEmail,
    password: loginPassword,
    setPassword: setLoginPassword,
    onLogin: handleLogin,
    loginError,
    isRecoveryMode,
    recoveryPassword,
    setRecoveryPassword,
    recoveryPasswordConfirm,
    setRecoveryPasswordConfirm,
    recoveryError,
    recoveryInfo,
    onCompleteRecovery: completePasswordRecovery,
    passwordRecoveryInfo,
    passwordRecoveryError,
    passwordRecoveryCooldownSeconds,
    onSendPasswordRecovery: sendPasswordRecoveryEmail,
    otpCode,
    setOtpCode,
    otpInfo,
    otpError,
    onSendEmailOtpCode: sendEmailOtpCode,
    onLoginWithEmailOtpCode: loginWithEmailOtpCode,
    quickLogin: handleQuickLogin,
    showQuickLogin,
  };

  const appHeaderProps: ComponentProps<typeof AppHeader> = {
    currentUser: appState.currentUser!,
    role: appState.role,
    showQuickLogin,
    onSwitchRole: (role) => patchState({ role }),
    onResetData: handleResetData,
    onLogout: handleLogout,
  };

  const trainerLayoutProps: ComponentProps<typeof TrainerLayout> = {
    appState,
    trainerTab,
    setTrainerTab,
    patchState,
    addMember,
    deactivateMember,
    deleteMember,
    updateMember,
    markMemberInvited,
    inviteMember,
    inviteTrainer,
    restoreMemberByEmail,
    restoreMissingTestData,
    restoreOriginalExerciseBank,
    saveProgramForMember,
    deleteProgramById,
    sendTrainerMessage,
    saveExercise,
    openCustomerMessagesSignal,
    setOpenCustomerMessagesSignal,
    memberAvatarById,
    setMemberAvatarUrlForMember,
    trainerNotificationsOpen,
    setTrainerNotificationsOpen,
    trainerUnreadCount,
    trainerMessageAlerts,
    handleTrainerBellToggle,
  };

  const memberLayoutProps: ComponentProps<typeof MemberLayout> = {
    appState,
    memberTab,
    setMemberTab,
    updateMember,
    currentMemberAvatarUrl,
    setCurrentMemberAvatarUrl,
    sendMemberMessage,
    startWorkoutMode,
    updateWorkoutExerciseResult,
    replaceWorkoutExerciseGroup,
    updateWorkoutModeNote,
    finishWorkoutMode,
    cancelWorkoutMode,
    dismissWorkoutCelebration,
    memberNotificationsOpen,
    memberUnreadCount,
    memberVisibleAlerts,
    handleMemberBellToggle,
    openAlert,
  };

  return {
    appState,
    isRecoveryMode,
    loginScreenProps,
    appHeaderProps,
    trainerLayoutProps,
    memberLayoutProps,
  };
}

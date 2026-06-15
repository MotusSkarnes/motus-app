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
  const [openCustomerNutritionSignal, setOpenCustomerNutritionSignal] = useState(0);
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
    trainerUnreadMessageCount,
    memberUnreadMessageCount,
    memberUnreadCount,
    handleTrainerBellToggle,
    handleMemberBellToggle,
    markMemberMessagesAsRead,
    markTrainerMessagesReadForMember,
    markAllTrainerAlertsAsRead,
    markAllMemberAlertsAsRead,
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
    memberUnreadMessageCount,
    memberNotificationsOpen,
    memberVisibleAlerts,
    onMemberBellToggle: handleMemberBellToggle,
    onMemberMessagesClick: () => {
      if (layoutRole === "member" && !isMemberLimited) {
        markMemberMessagesAsRead();
      }
      state.setMemberTab("messages");
    },
    onOpenMemberAlert: openAlert,
    onMarkAllMemberAlertsAsRead: markAllMemberAlertsAsRead,
    showMemberNotifications: layoutRole === "member" && !isMemberLimited,
    showMemberMessages: layoutRole === "member",
    trainerUnreadCount,
    trainerNotificationsOpen,
    trainerVisibleAlerts,
    onTrainerBellToggle: handleTrainerBellToggle,
    onOpenTrainerAlert: openTrainerAlert,
    onMarkAllTrainerAlertsAsRead: markAllTrainerAlertsAsRead,
    showTrainerNotifications: layoutRole === "trainer",
  });

  const sendTrainerMessage = useCallback(
    (memberId: string, text: string) => {
      state.sendTrainerMessage(memberId, text);
      if (text.trim()) {
        markTrainerMessagesReadForMember(memberId);
      }
    },
    [markTrainerMessagesReadForMember, state.sendTrainerMessage],
  );

  const trainerUnreadMessagesByMemberId = useMemo(() => {
    const counts: Record<string, number> = {};
    trainerVisibleAlerts.forEach((alert) => {
      if (alert.kind !== "message" || !alert.isUnread) return;
      const memberId = String(alert.memberId ?? "").trim();
      if (!memberId) return;
      counts[memberId] = (counts[memberId] ?? 0) + 1;
    });
    return counts;
  }, [trainerVisibleAlerts]);

  const trainerLayoutProps: ComponentProps<typeof TrainerLayout> = buildTrainerLayoutProps({
    appState: state.appState,
    trainerTab: state.trainerTab,
    setTrainerTab: state.setTrainerTab,
    patchState: state.patchState,
    messageBadgeCount: trainerUnreadMessageCount,
    unreadMessagesByMemberId: trainerUnreadMessagesByMemberId,
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
    restoreMembersFromRosterBackup: state.restoreMembersFromRosterBackup,
    restoreOriginalExerciseBank: state.restoreOriginalExerciseBank,
    saveProgramForMember: state.saveProgramForMember,
    deleteProgramById: state.deleteProgramById,
    sendTrainerMessage,
    toggleChatMessageReaction: state.toggleChatMessageReaction,
    markChatConversationRead: state.markChatConversationRead,
    updateWorkoutLogTrainerComment: state.updateWorkoutLogTrainerComment,
    updateWorkoutLogDate: state.updateWorkoutLogDate,
    deleteWorkoutLog: state.deleteWorkoutLog,
    clearLocalChatCache: state.clearLocalChatCache,
    saveExercise: state.saveExercise,
    deleteExercise: state.deleteExercise,
    openCustomerMessagesSignal,
    setOpenCustomerMessagesSignal,
    openCustomerOverviewSignal,
    setOpenCustomerOverviewSignal,
    openCustomerNutritionSignal,
    setOpenCustomerNutritionSignal,
    memberAvatarById,
    setMemberAvatarUrlForMember,
    isLocalDemoSession: state.isLocalDemoSession,
    remoteTrainerPeriodPlansByMemberId: state.remoteTrainerPeriodPlansByMemberId,
    applyTrainerProfileSaved: state.applyTrainerProfileSaved,
    workoutMode: state.appState.workoutMode,
    startWorkoutMode: state.startWorkoutMode,
    updateWorkoutExerciseResult: state.updateWorkoutExerciseResult,
    replaceWorkoutExerciseGroup: state.replaceWorkoutExerciseGroup,
    addWorkoutExerciseToWorkout: state.addWorkoutExerciseToWorkout,
    appendWorkoutSetForProgramExercise: state.appendWorkoutSetForProgramExercise,
    removeLastWorkoutSetForProgramExercise: state.removeLastWorkoutSetForProgramExercise,
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
    markChatConversationRead: state.markChatConversationRead,
    startWorkoutMode: state.startWorkoutMode,
    startCustomWorkout: state.startCustomWorkout,
    saveProgramForMember: state.saveProgramForMember,
    deleteProgramById: state.deleteProgramById,
    updateProgramMemberLibraryStatus: state.updateProgramMemberLibraryStatus,
    updateWorkoutExerciseResult: state.updateWorkoutExerciseResult,
    replaceWorkoutExerciseGroup: state.replaceWorkoutExerciseGroup,
    addWorkoutExerciseToWorkout: state.addWorkoutExerciseToWorkout,
    appendWorkoutSetForProgramExercise: state.appendWorkoutSetForProgramExercise,
    removeLastWorkoutSetForProgramExercise: state.removeLastWorkoutSetForProgramExercise,
    deferWorkoutExerciseGroup: state.deferWorkoutExerciseGroup,
    removeWorkoutLogResult: state.removeWorkoutLogResult,
    setWorkoutLogResults: state.setWorkoutLogResults,
    updateWorkoutLogDate: state.updateWorkoutLogDate,
    updateWorkoutModeNote: state.updateWorkoutModeNote,
    updateWorkoutExerciseNote: state.updateWorkoutExerciseNote,
    finishWorkoutMode: state.finishWorkoutMode,
    logGroupWorkout: state.logGroupWorkout,
    logActivityWorkout: state.logActivityWorkout,
    updateActivityWorkout: state.updateActivityWorkout,
    updateGroupWorkoutLog: state.updateGroupWorkoutLog,
    deleteWorkoutLog: state.deleteWorkoutLog,
    logIntervalWorkout: state.logIntervalWorkout,
    logCompletedPlanEntry: state.logCompletedPlanEntry,
    removeGroupWorkoutLog: state.removeGroupWorkoutLog,
    removeCompletedPlanEntryLog: state.removeCompletedPlanEntryLog,
    cancelWorkoutMode: state.cancelWorkoutMode,
    dismissWorkoutMode: state.dismissWorkoutMode,
    resumePausedWorkout: state.resumePausedWorkout,
    discardPausedWorkoutDraft: state.discardPausedWorkoutDraft,
    dismissWorkoutCelebration: state.dismissWorkoutCelebration,
    recentlyFinishedLogId: state.recentlyFinishedLogId,
    dismissRecentlyFinishedLog: state.dismissRecentlyFinishedLog,
    memberNotificationsOpen,
    memberUnreadCount,
    memberUnreadMessageCount,
    onMemberMessagesClick: () => {
      if (!isMemberLimited) {
        markMemberMessagesAsRead();
      }
      state.setMemberTab("messages");
    },
    memberVisibleAlerts,
    handleMemberBellToggle,
    openAlert,
    markAllMemberAlertsAsRead,
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
    memberNoPlanCoverImageUrl: state.memberNoPlanCoverImageUrl,
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

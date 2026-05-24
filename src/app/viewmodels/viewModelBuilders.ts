import type { ComponentProps, Dispatch, SetStateAction } from "react";
import { AppHeader, LoginScreen, MemberLayout, TrainerLayout } from "../../features";
import type { AppState } from "../types";

type LoginScreenProps = ComponentProps<typeof LoginScreen>;
type AppHeaderProps = ComponentProps<typeof AppHeader>;
type AppHeaderPropsWithUser = Omit<AppHeaderProps, "currentUser"> & {
  currentUser: NonNullable<AppState["currentUser"]>;
};
type TrainerLayoutProps = ComponentProps<typeof TrainerLayout>;
type MemberLayoutProps = ComponentProps<typeof MemberLayout>;

export function buildLoginScreenProps(
  input: LoginScreenProps
): LoginScreenProps {
  return input;
}

export function buildAppHeaderProps(input: AppHeaderPropsWithUser): AppHeaderProps {
  return input;
}

export function buildTrainerLayoutProps(input: {
  appState: AppState;
  trainerTab: TrainerLayoutProps["trainerTab"];
  setTrainerTab: TrainerLayoutProps["setTrainerTab"];
  patchState: TrainerLayoutProps["patchState"];
  addMember: TrainerLayoutProps["addMember"];
  deactivateMember: TrainerLayoutProps["deactivateMember"];
  deleteMember: TrainerLayoutProps["deleteMember"];
  updateMember: TrainerLayoutProps["updateMember"];
  markMemberInvited: TrainerLayoutProps["markMemberInvited"];
  inviteMember: TrainerLayoutProps["inviteMember"];
  inviteTrainer: TrainerLayoutProps["inviteTrainer"];
  restoreMemberByEmail: TrainerLayoutProps["restoreMemberByEmail"];
  reassignMemberOwner: TrainerLayoutProps["reassignMemberOwner"];
  restoreMissingTestData: TrainerLayoutProps["restoreMissingTestData"];
  restoreOriginalExerciseBank: TrainerLayoutProps["restoreOriginalExerciseBank"];
  saveProgramForMember: TrainerLayoutProps["saveProgramForMember"];
  deleteProgramById: TrainerLayoutProps["deleteProgramById"];
  sendTrainerMessage: TrainerLayoutProps["sendTrainerMessage"];
  toggleChatMessageReaction: TrainerLayoutProps["toggleChatMessageReaction"];
  updateWorkoutLogTrainerComment?: TrainerLayoutProps["updateWorkoutLogTrainerComment"];
  clearLocalChatCache: TrainerLayoutProps["clearLocalChatCache"];
  saveExercise: TrainerLayoutProps["saveExercise"];
  deleteExercise: TrainerLayoutProps["deleteExercise"];
  openCustomerMessagesSignal: number;
  setOpenCustomerMessagesSignal: Dispatch<SetStateAction<number>>;
  openCustomerOverviewSignal: number;
  setOpenCustomerOverviewSignal: Dispatch<SetStateAction<number>>;
  memberAvatarById: TrainerLayoutProps["memberAvatarById"];
  setMemberAvatarUrlForMember: TrainerLayoutProps["setMemberAvatarUrlForMember"];
  isLocalDemoSession: boolean;
  remoteTrainerPeriodPlansByMemberId: TrainerLayoutProps["remoteTrainerPeriodPlansByMemberId"];
  applyTrainerProfileSaved: TrainerLayoutProps["applyTrainerProfileSaved"];
  workoutMode: TrainerLayoutProps["workoutMode"];
  startWorkoutMode: TrainerLayoutProps["startWorkoutMode"];
  updateWorkoutExerciseResult: TrainerLayoutProps["updateWorkoutExerciseResult"];
  replaceWorkoutExerciseGroup: TrainerLayoutProps["replaceWorkoutExerciseGroup"];
  appendWorkoutSetForProgramExercise: TrainerLayoutProps["appendWorkoutSetForProgramExercise"];
  deferWorkoutExerciseGroup: TrainerLayoutProps["deferWorkoutExerciseGroup"];
  updateWorkoutModeNote: TrainerLayoutProps["updateWorkoutModeNote"];
  finishWorkoutMode: TrainerLayoutProps["finishWorkoutMode"];
  cancelWorkoutMode: TrainerLayoutProps["cancelWorkoutMode"];
}): TrainerLayoutProps {
  return input;
}

export function buildMemberLayoutProps(input: {
  appState: AppState;
  patchState: MemberLayoutProps["patchState"];
  memberTab: MemberLayoutProps["memberTab"];
  setMemberTab: MemberLayoutProps["setMemberTab"];
  updateMember: MemberLayoutProps["updateMember"];
  currentMemberAvatarUrl: string;
  setCurrentMemberAvatarUrl: (url: string) => void;
  sendMemberMessage: MemberLayoutProps["sendMemberMessage"];
  toggleChatMessageReaction: MemberLayoutProps["toggleChatMessageReaction"];
  startWorkoutMode: MemberLayoutProps["startWorkoutMode"];
  startCustomWorkout: MemberLayoutProps["startCustomWorkout"];
  saveProgramForMember: MemberLayoutProps["saveProgramForMember"];
  deleteProgramById: MemberLayoutProps["deleteProgramById"];
  updateProgramMemberLibraryStatus: MemberLayoutProps["updateProgramMemberLibraryStatus"];
  updateWorkoutExerciseResult: MemberLayoutProps["updateWorkoutExerciseResult"];
  replaceWorkoutExerciseGroup: MemberLayoutProps["replaceWorkoutExerciseGroup"];
  appendWorkoutSetForProgramExercise: MemberLayoutProps["appendWorkoutSetForProgramExercise"];
  deferWorkoutExerciseGroup: MemberLayoutProps["deferWorkoutExerciseGroup"];
  removeWorkoutLogResult: MemberLayoutProps["removeWorkoutLogResult"];
  setWorkoutLogResults: MemberLayoutProps["setWorkoutLogResults"];
  updateWorkoutModeNote: MemberLayoutProps["updateWorkoutModeNote"];
  finishWorkoutMode: MemberLayoutProps["finishWorkoutMode"];
  logGroupWorkout: MemberLayoutProps["logGroupWorkout"];
  logIntervalWorkout: MemberLayoutProps["logIntervalWorkout"];
  logCompletedPlanEntry: MemberLayoutProps["logCompletedPlanEntry"];
  removeGroupWorkoutLog: MemberLayoutProps["removeGroupWorkoutLog"];
  removeCompletedPlanEntryLog: MemberLayoutProps["removeCompletedPlanEntryLog"];
  cancelWorkoutMode: MemberLayoutProps["cancelWorkoutMode"];
  dismissWorkoutMode: MemberLayoutProps["dismissWorkoutMode"];
  resumePausedWorkout: MemberLayoutProps["resumePausedWorkout"];
  discardPausedWorkoutDraft: MemberLayoutProps["discardPausedWorkoutDraft"];
  dismissWorkoutCelebration: MemberLayoutProps["dismissWorkoutCelebration"];
  memberNotificationsOpen: boolean;
  memberUnreadCount: number;
  memberVisibleAlerts: MemberLayoutProps["memberVisibleAlerts"];
  handleMemberBellToggle: () => void;
  openAlert: MemberLayoutProps["openAlert"];
  markMemberInspirationAsSeen: MemberLayoutProps["markMemberInspirationAsSeen"];
  memberFocusInspirationItemId: MemberLayoutProps["memberFocusInspirationItemId"];
  clearMemberFocusInspirationItemId: MemberLayoutProps["clearMemberFocusInspirationItemId"];
  memberFocusWorkoutLogId: MemberLayoutProps["memberFocusWorkoutLogId"];
  clearMemberFocusWorkoutLogId: MemberLayoutProps["clearMemberFocusWorkoutLogId"];
  memberFocusProgramId: MemberLayoutProps["memberFocusProgramId"];
  clearMemberFocusProgramId: MemberLayoutProps["clearMemberFocusProgramId"];
  memberCheckInOverlayOpen: MemberLayoutProps["memberCheckInOverlayOpen"];
  setMemberCheckInOverlayOpen: MemberLayoutProps["setMemberCheckInOverlayOpen"];
  remoteMemberPeriodPlanRows: MemberLayoutProps["remoteMemberPeriodPlanRows"];
  memberRemoteHydrated?: MemberLayoutProps["memberRemoteHydrated"];
  refreshRemoteHydration?: MemberLayoutProps["refreshRemoteHydration"];
  onLogout: MemberLayoutProps["onLogout"];
}): MemberLayoutProps {
  return input;
}

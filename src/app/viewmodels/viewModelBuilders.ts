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
  restoreMissingTestData: TrainerLayoutProps["restoreMissingTestData"];
  restoreOriginalExerciseBank: TrainerLayoutProps["restoreOriginalExerciseBank"];
  saveProgramForMember: TrainerLayoutProps["saveProgramForMember"];
  deleteProgramById: TrainerLayoutProps["deleteProgramById"];
  sendTrainerMessage: TrainerLayoutProps["sendTrainerMessage"];
  saveExercise: TrainerLayoutProps["saveExercise"];
  deleteExercise: TrainerLayoutProps["deleteExercise"];
  openCustomerMessagesSignal: number;
  setOpenCustomerMessagesSignal: Dispatch<SetStateAction<number>>;
  memberAvatarById: TrainerLayoutProps["memberAvatarById"];
  setMemberAvatarUrlForMember: TrainerLayoutProps["setMemberAvatarUrlForMember"];
  trainerNotificationsOpen: boolean;
  setTrainerNotificationsOpen: (open: boolean) => void;
  trainerUnreadCount: number;
  trainerMessageAlerts: TrainerLayoutProps["trainerMessageAlerts"];
  handleTrainerBellToggle: () => void;
  isLocalDemoSession: boolean;
}): TrainerLayoutProps {
  return input;
}

export function buildMemberLayoutProps(input: {
  appState: AppState;
  memberTab: MemberLayoutProps["memberTab"];
  setMemberTab: MemberLayoutProps["setMemberTab"];
  updateMember: MemberLayoutProps["updateMember"];
  currentMemberAvatarUrl: string;
  setCurrentMemberAvatarUrl: (url: string) => void;
  sendMemberMessage: MemberLayoutProps["sendMemberMessage"];
  startWorkoutMode: MemberLayoutProps["startWorkoutMode"];
  updateWorkoutExerciseResult: MemberLayoutProps["updateWorkoutExerciseResult"];
  replaceWorkoutExerciseGroup: MemberLayoutProps["replaceWorkoutExerciseGroup"];
  removeWorkoutLogResult: MemberLayoutProps["removeWorkoutLogResult"];
  setWorkoutLogResults: MemberLayoutProps["setWorkoutLogResults"];
  updateWorkoutModeNote: MemberLayoutProps["updateWorkoutModeNote"];
  finishWorkoutMode: MemberLayoutProps["finishWorkoutMode"];
  logGroupWorkout: MemberLayoutProps["logGroupWorkout"];
  cancelWorkoutMode: MemberLayoutProps["cancelWorkoutMode"];
  dismissWorkoutCelebration: MemberLayoutProps["dismissWorkoutCelebration"];
  memberNotificationsOpen: boolean;
  memberUnreadCount: number;
  memberVisibleAlerts: MemberLayoutProps["memberVisibleAlerts"];
  handleMemberBellToggle: () => void;
  openAlert: MemberLayoutProps["openAlert"];
}): MemberLayoutProps {
  return input;
}

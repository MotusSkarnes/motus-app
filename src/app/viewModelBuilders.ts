import type { ComponentProps, Dispatch, SetStateAction } from "react";
import { AppHeader } from "../features/AppHeader";
import { LoginScreen } from "../features/LoginScreen";
import { MemberLayout } from "../features/MemberLayout";
import { TrainerLayout } from "../features/TrainerLayout";
import type { AppState } from "./types";

export function buildLoginScreenProps(
  input: ComponentProps<typeof LoginScreen>
): ComponentProps<typeof LoginScreen> {
  return input;
}

export function buildAppHeaderProps(input: {
  currentUser: NonNullable<AppState["currentUser"]>;
  role: AppState["role"];
  showQuickLogin: boolean;
  onSwitchRole: (role: AppState["role"]) => void;
  onResetData: () => void;
  onLogout: () => void;
}): ComponentProps<typeof AppHeader> {
  return input;
}

export function buildTrainerLayoutProps(input: {
  appState: AppState;
  trainerTab: ComponentProps<typeof TrainerLayout>["trainerTab"];
  setTrainerTab: ComponentProps<typeof TrainerLayout>["setTrainerTab"];
  patchState: ComponentProps<typeof TrainerLayout>["patchState"];
  addMember: ComponentProps<typeof TrainerLayout>["addMember"];
  deactivateMember: ComponentProps<typeof TrainerLayout>["deactivateMember"];
  deleteMember: ComponentProps<typeof TrainerLayout>["deleteMember"];
  updateMember: ComponentProps<typeof TrainerLayout>["updateMember"];
  markMemberInvited: ComponentProps<typeof TrainerLayout>["markMemberInvited"];
  inviteMember: ComponentProps<typeof TrainerLayout>["inviteMember"];
  inviteTrainer: ComponentProps<typeof TrainerLayout>["inviteTrainer"];
  restoreMemberByEmail: ComponentProps<typeof TrainerLayout>["restoreMemberByEmail"];
  restoreMissingTestData: ComponentProps<typeof TrainerLayout>["restoreMissingTestData"];
  restoreOriginalExerciseBank: ComponentProps<typeof TrainerLayout>["restoreOriginalExerciseBank"];
  saveProgramForMember: ComponentProps<typeof TrainerLayout>["saveProgramForMember"];
  deleteProgramById: ComponentProps<typeof TrainerLayout>["deleteProgramById"];
  sendTrainerMessage: ComponentProps<typeof TrainerLayout>["sendTrainerMessage"];
  saveExercise: ComponentProps<typeof TrainerLayout>["saveExercise"];
  openCustomerMessagesSignal: number;
  setOpenCustomerMessagesSignal: Dispatch<SetStateAction<number>>;
  memberAvatarById: ComponentProps<typeof TrainerLayout>["memberAvatarById"];
  setMemberAvatarUrlForMember: ComponentProps<typeof TrainerLayout>["setMemberAvatarUrlForMember"];
  trainerNotificationsOpen: boolean;
  setTrainerNotificationsOpen: (open: boolean) => void;
  trainerUnreadCount: number;
  trainerMessageAlerts: ComponentProps<typeof TrainerLayout>["trainerMessageAlerts"];
  handleTrainerBellToggle: () => void;
}): ComponentProps<typeof TrainerLayout> {
  return input;
}

export function buildMemberLayoutProps(input: {
  appState: AppState;
  memberTab: ComponentProps<typeof MemberLayout>["memberTab"];
  setMemberTab: ComponentProps<typeof MemberLayout>["setMemberTab"];
  updateMember: ComponentProps<typeof MemberLayout>["updateMember"];
  currentMemberAvatarUrl: string;
  setCurrentMemberAvatarUrl: (url: string) => void;
  sendMemberMessage: ComponentProps<typeof MemberLayout>["sendMemberMessage"];
  startWorkoutMode: ComponentProps<typeof MemberLayout>["startWorkoutMode"];
  updateWorkoutExerciseResult: ComponentProps<typeof MemberLayout>["updateWorkoutExerciseResult"];
  replaceWorkoutExerciseGroup: ComponentProps<typeof MemberLayout>["replaceWorkoutExerciseGroup"];
  updateWorkoutModeNote: ComponentProps<typeof MemberLayout>["updateWorkoutModeNote"];
  finishWorkoutMode: ComponentProps<typeof MemberLayout>["finishWorkoutMode"];
  cancelWorkoutMode: ComponentProps<typeof MemberLayout>["cancelWorkoutMode"];
  dismissWorkoutCelebration: ComponentProps<typeof MemberLayout>["dismissWorkoutCelebration"];
  memberNotificationsOpen: boolean;
  memberUnreadCount: number;
  memberVisibleAlerts: ComponentProps<typeof MemberLayout>["memberVisibleAlerts"];
  handleMemberBellToggle: () => void;
  openAlert: ComponentProps<typeof MemberLayout>["openAlert"];
}): ComponentProps<typeof MemberLayout> {
  return input;
}

import type { ComponentProps } from "react";
import type { AppHeader, LoginScreen, MemberLayout, TrainerLayout } from "../../features";
import type { MemberTab } from "../types";
import type { useAppState } from "../useAppState";

export type MemberMobileNavProps = {
  memberTab: MemberTab;
  setMemberTab: (tab: MemberTab) => void;
  isMemberLimited: boolean;
};

export type AppStateHookResult = ReturnType<typeof useAppState>;

export type AuthViewModel = {
  isRecoveryMode: boolean;
  loginScreenProps: ComponentProps<typeof LoginScreen>;
};

export type RoleViewModel = {
  appHeaderProps: ComponentProps<typeof AppHeader>;
  trainerLayoutProps: ComponentProps<typeof TrainerLayout>;
  memberLayoutProps: ComponentProps<typeof MemberLayout>;
  memberMobileNavProps: MemberMobileNavProps | null;
};

export type AppViewModel = {
  appState: AppStateHookResult["appState"];
  isAuthSessionLoading: AppStateHookResult["isAuthSessionLoading"];
} & AuthViewModel &
  RoleViewModel;

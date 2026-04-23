import type { ComponentProps } from "react";
import type { AppHeader, LoginScreen, MemberLayout, TrainerLayout } from "../../features";
import type { useAppState } from "../useAppState";

export type AppStateHookResult = ReturnType<typeof useAppState>;

export type AuthViewModel = {
  isRecoveryMode: boolean;
  loginScreenProps: ComponentProps<typeof LoginScreen>;
};

export type RoleViewModel = {
  appHeaderProps: ComponentProps<typeof AppHeader>;
  trainerLayoutProps: ComponentProps<typeof TrainerLayout>;
  memberLayoutProps: ComponentProps<typeof MemberLayout>;
};

export type AppViewModel = {
  appState: AppStateHookResult["appState"];
} & AuthViewModel &
  RoleViewModel;

import { useAppState } from "../useAppState";
import { useAuthViewModel } from "./useAuthViewModel";
import { useRoleViewModel } from "./useRoleViewModel";
import type { AppViewModel } from "./types";

export function useAppViewModel(): AppViewModel {
  const state = useAppState();
  const { isRecoveryMode, loginScreenProps } = useAuthViewModel(state);
  const { appHeaderProps, trainerLayoutProps, memberLayoutProps } = useRoleViewModel(state);

  return {
    appState: state.appState,
    isRecoveryMode,
    loginScreenProps,
    appHeaderProps,
    trainerLayoutProps,
    memberLayoutProps,
  };
}

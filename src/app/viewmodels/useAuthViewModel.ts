import type { ComponentProps } from "react";
import { LoginScreen } from "../../features/LoginScreen";
import { buildLoginScreenProps } from "./viewModelBuilders";
import type { AppStateHookResult } from "./types";

export function useAuthViewModel(state: AppStateHookResult) {
  const loginScreenProps: ComponentProps<typeof LoginScreen> = buildLoginScreenProps({
    email: state.loginEmail,
    setEmail: state.setLoginEmail,
    password: state.loginPassword,
    setPassword: state.setLoginPassword,
    onLogin: state.handleLogin,
    loginError: state.loginError,
    isRecoveryMode: state.isRecoveryMode,
    recoveryPassword: state.recoveryPassword,
    setRecoveryPassword: state.setRecoveryPassword,
    recoveryPasswordConfirm: state.recoveryPasswordConfirm,
    setRecoveryPasswordConfirm: state.setRecoveryPasswordConfirm,
    recoveryError: state.recoveryError,
    recoveryInfo: state.recoveryInfo,
    onCompleteRecovery: state.completePasswordRecovery,
    passwordRecoveryInfo: state.passwordRecoveryInfo,
    passwordRecoveryError: state.passwordRecoveryError,
    passwordRecoveryCooldownSeconds: state.passwordRecoveryCooldownSeconds,
    onSendPasswordRecovery: state.sendPasswordRecoveryEmail,
    otpCode: state.otpCode,
    setOtpCode: state.setOtpCode,
    otpInfo: state.otpInfo,
    otpError: state.otpError,
    onSendEmailOtpCode: state.sendEmailOtpCode,
    onLoginWithEmailOtpCode: state.loginWithEmailOtpCode,
    quickLogin: state.handleQuickLogin,
    showQuickLogin: state.showQuickLogin,
  });

  return {
    isRecoveryMode: state.isRecoveryMode,
    loginScreenProps,
  };
}

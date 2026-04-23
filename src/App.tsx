import { useState } from "react";
import { useMemberAvatarStore } from "./app/useMemberAvatarStore";
import { useNotifications } from "./app/useNotifications";
import { useAppState } from "./app/useAppState";
import { AppShell } from "./app/ui";
import { AppHeader } from "./features/AppHeader";
import { LoginScreen } from "./features/LoginScreen";
import { MemberLayout } from "./features/MemberLayout";
import { TrainerLayout } from "./features/TrainerLayout";

export default function App() {
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

  return (
    <AppShell>
      {!appState.currentUser || isRecoveryMode ? (
        <LoginScreen
          email={loginEmail}
          setEmail={setLoginEmail}
          password={loginPassword}
          setPassword={setLoginPassword}
          onLogin={handleLogin}
          loginError={loginError}
          isRecoveryMode={isRecoveryMode}
          recoveryPassword={recoveryPassword}
          setRecoveryPassword={setRecoveryPassword}
          recoveryPasswordConfirm={recoveryPasswordConfirm}
          setRecoveryPasswordConfirm={setRecoveryPasswordConfirm}
          recoveryError={recoveryError}
          recoveryInfo={recoveryInfo}
          onCompleteRecovery={completePasswordRecovery}
          passwordRecoveryInfo={passwordRecoveryInfo}
          passwordRecoveryError={passwordRecoveryError}
          passwordRecoveryCooldownSeconds={passwordRecoveryCooldownSeconds}
          onSendPasswordRecovery={sendPasswordRecoveryEmail}
          otpCode={otpCode}
          setOtpCode={setOtpCode}
          otpInfo={otpInfo}
          otpError={otpError}
          onSendEmailOtpCode={sendEmailOtpCode}
          onLoginWithEmailOtpCode={loginWithEmailOtpCode}
          quickLogin={handleQuickLogin}
          showQuickLogin={showQuickLogin}
        />
      ) : (
        <div className="space-y-6 pb-20 sm:pb-6">
          <AppHeader
            currentUser={appState.currentUser}
            role={appState.role}
            showQuickLogin={showQuickLogin}
            onSwitchRole={(role) => patchState({ role })}
            onResetData={handleResetData}
            onLogout={handleLogout}
          />

          {appState.role === "trainer" ? (
            <TrainerLayout
              appState={appState}
              trainerTab={trainerTab}
              setTrainerTab={setTrainerTab}
              patchState={patchState}
              addMember={addMember}
              deactivateMember={deactivateMember}
              deleteMember={deleteMember}
              updateMember={updateMember}
              markMemberInvited={markMemberInvited}
              inviteMember={inviteMember}
              inviteTrainer={inviteTrainer}
              restoreMemberByEmail={restoreMemberByEmail}
              restoreMissingTestData={restoreMissingTestData}
              restoreOriginalExerciseBank={restoreOriginalExerciseBank}
              saveProgramForMember={saveProgramForMember}
              deleteProgramById={deleteProgramById}
              sendTrainerMessage={sendTrainerMessage}
              saveExercise={saveExercise}
              openCustomerMessagesSignal={openCustomerMessagesSignal}
              setOpenCustomerMessagesSignal={setOpenCustomerMessagesSignal}
              memberAvatarById={memberAvatarById}
              setMemberAvatarUrlForMember={setMemberAvatarUrlForMember}
              trainerNotificationsOpen={trainerNotificationsOpen}
              setTrainerNotificationsOpen={setTrainerNotificationsOpen}
              trainerUnreadCount={trainerUnreadCount}
              trainerMessageAlerts={trainerMessageAlerts}
              handleTrainerBellToggle={handleTrainerBellToggle}
            />
          ) : (
            <MemberLayout
              appState={appState}
              memberTab={memberTab}
              setMemberTab={setMemberTab}
              updateMember={updateMember}
              currentMemberAvatarUrl={currentMemberAvatarUrl}
              setCurrentMemberAvatarUrl={setCurrentMemberAvatarUrl}
              sendMemberMessage={sendMemberMessage}
              startWorkoutMode={startWorkoutMode}
              updateWorkoutExerciseResult={updateWorkoutExerciseResult}
              replaceWorkoutExerciseGroup={replaceWorkoutExerciseGroup}
              updateWorkoutModeNote={updateWorkoutModeNote}
              finishWorkoutMode={finishWorkoutMode}
              cancelWorkoutMode={cancelWorkoutMode}
              dismissWorkoutCelebration={dismissWorkoutCelebration}
              memberNotificationsOpen={memberNotificationsOpen}
              memberUnreadCount={memberUnreadCount}
              memberVisibleAlerts={memberVisibleAlerts}
              handleMemberBellToggle={handleMemberBellToggle}
              openAlert={openAlert}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}

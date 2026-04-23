import { useMemo, useState } from "react";
import { MOTUS } from "./app/data";
import { useMemberAvatarStore } from "./app/useMemberAvatarStore";
import { useNotifications } from "./app/useNotifications";
import { useAppState } from "./app/useAppState";
import { AppShell, Badge, Card, OutlineButton, PillButton } from "./app/ui";
import motusLogo from "./assets/motus-logo.png";
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

  const memberFirstName = useMemo(() => {
    const rawName = appState.currentUser?.name?.trim() ?? "";
    if (!rawName) return "du";
    return rawName.split(/\s+/)[0] || "du";
  }, [appState.currentUser?.name]);
  const memberMotivationText = useMemo(() => {
    const options = [
      "Klar for neste økt?",
      "Små steg i dag gir stor fremgang i morgen.",
      "Du er nærmere målet enn i går.",
      "En økt nå er en seier senere i uka.",
      "Bygg vanen - kroppen vil takke deg.",
    ];
    const daySeed = new Date().getDate();
    const nameSeed = memberFirstName.length;
    return options[(daySeed + nameSeed) % options.length];
  }, [memberFirstName]);

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
          <Card className="overflow-hidden p-4 sm:p-5 md:p-6">
            <div className="h-1.5 -mx-4 sm:-mx-5 md:-mx-6 -mt-4 sm:-mt-5 md:-mt-6 mb-5" style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 70%, ${MOTUS.acid} 100%)` }} />
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <img src={motusLogo} alt="Motus logo" className="h-14 w-auto object-contain" />
                  <Badge>{appState.currentUser.role === "trainer" ? "PT" : "Medlem"}</Badge>
                  <Badge>{appState.currentUser.name}</Badge>
                </div>
                <div>
                  {appState.currentUser.role === "member" ? (
                    <>
                      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Hei {memberFirstName}</h1>
                      <p className="mt-2 text-sm md:text-base text-slate-500 max-w-3xl">{memberMotivationText}</p>
                    </>
                  ) : (
                    <>
                      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Motus PT-app</h1>
                      <p className="mt-2 text-sm md:text-base text-slate-500 max-w-3xl">Administrer medlemmer, programmer og oppfolging pa ett sted.</p>
                    </>
                  )}
                </div>
              </div>
              {showQuickLogin ? (
                <Card className="p-1 w-full md:w-auto self-stretch md:self-auto">
                  <div className="grid w-full grid-cols-2 md:w-[280px] gap-1 rounded-2xl bg-slate-50 p-1">
                    <PillButton active={appState.role === "trainer"} onClick={() => patchState({ role: "trainer" })}>PT-side</PillButton>
                    <PillButton active={appState.role === "member"} onClick={() => patchState({ role: "member" })}>Medlemsside</PillButton>
                  </div>
                </Card>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                {showQuickLogin ? <OutlineButton onClick={handleResetData}>Nullstill testdata</OutlineButton> : null}
                <OutlineButton onClick={handleLogout}>Logg ut</OutlineButton>
              </div>
            </div>
          </Card>

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

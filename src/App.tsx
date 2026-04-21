import { ClipboardList, Dumbbell, LayoutDashboard, MessageSquare, TrendingUp, UserCircle2, Users } from "lucide-react";
import { MOTUS } from "./app/data";
import { useAppState } from "./app/useAppState";
import { AppShell, Badge, Card, MobileNavButton, OutlineButton, PillButton } from "./app/ui";
import motusLogo from "./assets/motus-logo.png";
import { LoginScreen } from "./features/LoginScreen";
import { MemberPortal } from "./features/MemberPortal";
import { TrainerPortal } from "./features/TrainerPortal";

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
    trainerTab,
    setTrainerTab,
    memberTab,
    setMemberTab,
    patchState,
    handleLogin,
    handleQuickLogin,
    completePasswordRecovery,
    sendPasswordRecoveryEmail,
    showQuickLogin,
    handleLogout,
    resetAllData,
    addMember,
    deactivateMember,
    markMemberInvited,
    saveProgramForMember,
    deleteProgramById,
    sendTrainerMessage,
    startWorkoutMode,
    updateWorkoutExerciseResult,
    updateWorkoutModeNote,
    finishWorkoutMode,
    cancelWorkoutMode,
    sendMemberMessage,
    inviteMember,
  } = useAppState();

  function handleResetData() {
    const shouldReset = window.confirm("Dette nullstiller alle testdata i appen. Er du sikker?");
    if (!shouldReset) return;
    resetAllData();
  }

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
                  <img src={motusLogo} alt="Motus logo" className="h-12 w-auto rounded-xl border border-slate-200 bg-white p-1" />
                  <Badge>{appState.currentUser.role === "trainer" ? "PT" : "Medlem"}</Badge>
                  <Badge>{appState.currentUser.name}</Badge>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Motus PT-app</h1>
                  <p className="mt-2 text-sm md:text-base text-slate-500 max-w-3xl">Administrer medlemmer, programmer og oppfolging pa ett sted.</p>
                </div>
              </div>
              <Card className="p-1 w-full md:w-auto self-stretch md:self-auto">
                <div className="grid w-full grid-cols-2 md:w-[280px] gap-1 rounded-2xl bg-slate-50 p-1">
                  <PillButton active={appState.role === "trainer"} onClick={() => patchState({ role: "trainer" })}>PT-side</PillButton>
                  <PillButton active={appState.role === "member"} onClick={() => patchState({ role: "member" })}>Medlemsside</PillButton>
                </div>
              </Card>
              <div className="flex flex-col gap-2 sm:flex-row">
                <OutlineButton onClick={handleResetData}>Nullstill testdata</OutlineButton>
                <OutlineButton onClick={handleLogout}>Logg ut</OutlineButton>
              </div>
            </div>
          </Card>

          {appState.role === "trainer" ? (
            <TrainerPortal
              members={appState.members}
              programs={appState.programs}
              logs={appState.logs}
              messages={appState.messages}
              exercises={appState.exercises}
              selectedMemberId={appState.selectedMemberId}
              setSelectedMemberId={(id) => patchState({ selectedMemberId: id })}
              trainerTab={trainerTab}
              setTrainerTab={setTrainerTab}
              addMember={addMember}
              deactivateMember={deactivateMember}
              markMemberInvited={markMemberInvited}
              inviteMember={inviteMember}
              saveProgramForMember={saveProgramForMember}
              deleteProgramById={deleteProgramById}
              sendTrainerMessage={sendTrainerMessage}
            />
          ) : (
            <MemberPortal
              members={appState.members}
              programs={appState.programs}
              logs={appState.logs}
              messages={appState.messages}
              memberViewId={appState.memberViewId}
              setMemberViewId={(id) => patchState({ memberViewId: id })}
              memberTab={memberTab}
              setMemberTab={setMemberTab}
              sendMemberMessage={sendMemberMessage}
              workoutMode={appState.workoutMode}
              startWorkoutMode={startWorkoutMode}
              updateWorkoutExerciseResult={updateWorkoutExerciseResult}
              updateWorkoutModeNote={updateWorkoutModeNote}
              finishWorkoutMode={finishWorkoutMode}
              cancelWorkoutMode={cancelWorkoutMode}
            />
          )}

          <div className="fixed inset-x-0 bottom-0 z-[9999] border-t bg-white/95 px-2 pt-2 backdrop-blur lg:hidden" style={{ borderColor: "rgba(15,23,42,0.08)", paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}>
            <div className="mx-auto flex max-w-md items-center gap-1.5 rounded-[22px] border bg-slate-50/90 p-1.5 shadow-lg" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
              {appState.role === "trainer" ? (
                <>
                  <MobileNavButton active={trainerTab === "dashboard"} icon={<LayoutDashboard className="h-4 w-4" />} label="Oversikt" onClick={() => setTrainerTab("dashboard")} />
                  <MobileNavButton active={trainerTab === "customers"} icon={<Users className="h-4 w-4" />} label="Kunder" onClick={() => setTrainerTab("customers")} />
                  <MobileNavButton active={trainerTab === "programs"} icon={<ClipboardList className="h-4 w-4" />} label="Program" onClick={() => setTrainerTab("programs")} />
                  <MobileNavButton active={trainerTab === "exerciseBank"} icon={<Dumbbell className="h-4 w-4" />} label="Øvelser" onClick={() => setTrainerTab("exerciseBank")} />
                </>
              ) : (
                <>
                  <MobileNavButton active={memberTab === "overview"} icon={<LayoutDashboard className="h-4 w-4" />} label="Hjem" onClick={() => setMemberTab("overview")} />
                  <MobileNavButton active={memberTab === "programs"} icon={<ClipboardList className="h-4 w-4" />} label="Program" onClick={() => setMemberTab("programs")} />
                  <MobileNavButton active={memberTab === "progress"} icon={<TrendingUp className="h-4 w-4" />} label="Fremgang" onClick={() => setMemberTab("progress")} />
                  <MobileNavButton active={memberTab === "messages"} icon={<MessageSquare className="h-4 w-4" />} label="Meldinger" onClick={() => setMemberTab("messages")} />
                  <MobileNavButton active={memberTab === "profile"} icon={<UserCircle2 className="h-4 w-4" />} label="Profil" onClick={() => setMemberTab("profile")} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

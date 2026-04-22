import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BarChart3, Bell, CalendarDays, CheckSquare, ClipboardList, Dumbbell, LayoutDashboard, MessageSquare, Settings, ShieldCheck, TrendingUp, UserCircle2, Users } from "lucide-react";
import { MOTUS } from "./app/data";
import { useAppState } from "./app/useAppState";
import { AppShell, Badge, Card, OutlineButton, PillButton } from "./app/ui";
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

  const [trainerNotificationsOpen, setTrainerNotificationsOpen] = useState(false);
  const [memberNotificationsOpen, setMemberNotificationsOpen] = useState(false);
  const [openCustomerMessagesSignal, setOpenCustomerMessagesSignal] = useState(0);
  const [trainerAlertsSeenAt, setTrainerAlertsSeenAt] = useState(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem("motus.notifications.trainerSeenAt");
    const parsed = Number(raw ?? "0");
    return Number.isFinite(parsed) ? parsed : 0;
  });
  const [memberAlertsSeenAt, setMemberAlertsSeenAt] = useState(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem("motus.notifications.memberSeenAt");
    const parsed = Number(raw ?? "0");
    return Number.isFinite(parsed) ? parsed : 0;
  });
  const [seenMemberProgramIds, setSeenMemberProgramIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("motus.notifications.memberSeenProgramIds");
      const parsed = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [memberVisibleAlerts, setMemberVisibleAlerts] = useState<
    Array<{ id: string; text: string; timestamp: number; targetTab: "messages" | "programs" }>
  >([]);
  const [memberAvatarById, setMemberAvatarById] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem("motus.member.avatarById");
      const parsed = JSON.parse(raw ?? "{}") as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
      );
    } catch {
      return {};
    }
  });

  const memberById = useMemo(
    () => new Map(appState.members.map((member) => [member.id, member])),
    [appState.members]
  );

  function parseMessageTimestamp(value: string, fallbackOrder: number): number {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : fallbackOrder;
  }

  const trainerMessageAlerts = useMemo(() => {
    const latestByMember = new Map<string, { message: (typeof appState.messages)[number]; timestamp: number }>();
    appState.messages
      .filter((message) => message.sender === "member")
      .forEach((message, index) => {
        const timestamp = parseMessageTimestamp(message.createdAt, index + 1);
        const previous = latestByMember.get(message.memberId);
        if (!previous || timestamp > previous.timestamp) {
          latestByMember.set(message.memberId, { message, timestamp });
        }
      });

    return Array.from(latestByMember.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(({ message, timestamp }) => {
        const member = memberById.get(message.memberId);
        const name = member?.name || "Et medlem";
        return {
          id: `msg-${message.id}`,
          memberId: message.memberId,
          text: `${name} har sendt deg en ny melding`,
          timestamp,
        };
      });
  }, [appState.messages, memberById]);

  const inactiveMembersCount = appState.members.filter((member) => Number(member.daysSinceActivity || "0") >= 7).length;
  const missingInvitesCount = appState.members.filter((member) => !member.invitedAt).length;
  const memberPrograms = appState.programs
    .map((program, index) => ({
      ...program,
      _effectiveTimestamp: parseMessageTimestamp(program.createdAt, index + 1),
    }))
    .filter((program) => program.memberId === appState.memberViewId);
  const memberTrainerMessages = appState.messages
    .map((message, index) => ({
      ...message,
      _effectiveTimestamp: parseMessageTimestamp(message.createdAt, index + 1),
    }))
    .filter((message) => message.memberId === appState.memberViewId && message.sender === "trainer");
  const memberMessageAlerts = memberTrainerMessages.map((message) => ({
    id: `member-msg-${message.id}`,
    text: "Ny melding fra trener",
    timestamp: message._effectiveTimestamp,
    targetTab: "messages" as const,
  }));
  const memberProgramAlerts = memberPrograms.map((program) => ({
    id: `member-program-${program.id}`,
    text: `Du har fått nytt treningsprogram: ${program.title}`,
    timestamp: program._effectiveTimestamp,
    targetTab: "programs" as const,
    unread: !seenMemberProgramIds.includes(program.id),
  }));
  const memberUnreadAlerts = [...memberMessageAlerts, ...memberProgramAlerts]
    .filter((alert) => ("unread" in alert ? alert.unread : alert.timestamp > memberAlertsSeenAt))
    .sort((a, b) => b.timestamp - a.timestamp);
  const memberUnreadCount = memberUnreadAlerts.length;
  const trainerUnreadCount = trainerMessageAlerts.filter((alert) => alert.timestamp > trainerAlertsSeenAt).length;

  function handleTrainerBellToggle() {
    const willOpen = !trainerNotificationsOpen;
    setTrainerNotificationsOpen(willOpen);
    if (willOpen) {
      const latestAlertTime = trainerMessageAlerts.reduce((max, alert) => Math.max(max, alert.timestamp), 0);
      setTrainerAlertsSeenAt(latestAlertTime);
    }
  }

  function handleMemberBellToggle() {
    const willOpen = !memberNotificationsOpen;
    setMemberNotificationsOpen(willOpen);
    if (willOpen) {
      setMemberVisibleAlerts(memberUnreadAlerts);
      const latestAlertTime = [...memberMessageAlerts, ...memberProgramAlerts].reduce(
        (max, alert) => Math.max(max, alert.timestamp),
        0
      );
      setMemberAlertsSeenAt(latestAlertTime);
      setSeenMemberProgramIds((prev) => Array.from(new Set([...prev, ...memberPrograms.map((program) => program.id)])));
    } else {
      setMemberVisibleAlerts([]);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.notifications.trainerSeenAt", String(trainerAlertsSeenAt));
  }, [trainerAlertsSeenAt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.notifications.memberSeenAt", String(memberAlertsSeenAt));
  }, [memberAlertsSeenAt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.notifications.memberSeenProgramIds", JSON.stringify(seenMemberProgramIds));
  }, [seenMemberProgramIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.member.avatarById", JSON.stringify(memberAvatarById));
  }, [memberAvatarById]);

  const trainerMenuItems: Array<{ key: typeof trainerTab; label: string; icon: ReactNode }> = [
    { key: "dashboard", label: "Oversikt", icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "customers", label: "Klienter", icon: <Users className="h-4 w-4" /> },
    { key: "exerciseBank", label: "Øvelsesbank", icon: <Dumbbell className="h-4 w-4" /> },
    { key: "programs", label: "Programmer", icon: <ClipboardList className="h-4 w-4" /> },
    { key: "calendar", label: "Kalender", icon: <CalendarDays className="h-4 w-4" /> },
    { key: "messages", label: "Meldinger", icon: <MessageSquare className="h-4 w-4" /> },
    { key: "admin", label: "Admin", icon: <ShieldCheck className="h-4 w-4" /> },
    { key: "tasks", label: "Oppgaver", icon: <CheckSquare className="h-4 w-4" /> },
    { key: "statistics", label: "Statistikk", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "settings", label: "Innstillinger", icon: <Settings className="h-4 w-4" /> },
  ];

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
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Motus PT-app</h1>
                  <p className="mt-2 text-sm md:text-base text-slate-500 max-w-3xl">Administrer medlemmer, programmer og oppfolging pa ett sted.</p>
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
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <Card className="hidden h-fit p-3 md:block">
                <div className="mb-2 px-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">PT-meny</div>
                </div>
                <div className="space-y-1.5">
                  {trainerMenuItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTrainerTab(item.key)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium whitespace-nowrap transition ${
                        trainerTab === item.key
                          ? "border-transparent text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      style={
                        trainerTab === item.key
                          ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }
                          : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-2">
                        {item.icon}
                        <span>{item.label}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
              <div className="space-y-4">
                <Card className="p-4 bg-gradient-to-b from-emerald-50/80 to-pink-50/60">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-800">Varsler</div>
                    <button
                      type="button"
                      onClick={handleTrainerBellToggle}
                      className="relative rounded-xl border bg-white p-2 text-slate-700 hover:bg-emerald-50"
                      style={{ borderColor: "rgba(20,184,166,0.25)" }}
                      aria-label="Åpne varsler"
                    >
                      <Bell className="h-4 w-4" />
                      {trainerUnreadCount > 0 ? (
                        <span
                          className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                          style={{ backgroundColor: MOTUS.pink }}
                        >
                          {trainerUnreadCount}
                        </span>
                      ) : null}
                    </button>
                  </div>
                  {trainerNotificationsOpen ? (
                    <div className="mt-3 space-y-2">
                      {trainerMessageAlerts.map((alert) => (
                        <button
                          key={alert.id}
                          type="button"
                          onClick={() => {
                            patchState({ selectedMemberId: alert.memberId });
                            setTrainerTab("customers");
                            setOpenCustomerMessagesSignal((prev) => prev + 1);
                            setTrainerNotificationsOpen(false);
                          }}
                          className="w-full rounded-xl border bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50"
                          style={{ borderColor: "rgba(20,184,166,0.25)" }}
                        >
                          {alert.text}
                        </button>
                      ))}
                      {missingInvitesCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setTrainerTab("customers");
                            setTrainerNotificationsOpen(false);
                          }}
                          className="w-full rounded-xl border bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50"
                          style={{ borderColor: "rgba(20,184,166,0.25)" }}
                        >
                          {missingInvitesCount} kunder mangler invitasjon
                        </button>
                      ) : null}
                      {inactiveMembersCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setTrainerTab("customers");
                            setTrainerNotificationsOpen(false);
                          }}
                          className="w-full rounded-xl border bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50"
                          style={{ borderColor: "rgba(20,184,166,0.25)" }}
                        >
                          {inactiveMembersCount} kunder bør følges opp
                        </button>
                      ) : null}
                      {!trainerMessageAlerts.length && !missingInvitesCount && !inactiveMembersCount ? (
                        <div className="rounded-xl border border-dashed bg-white px-3 py-2 text-sm text-slate-500">
                          Ingen nye varsler akkurat nå.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-500">
                      Trykk på bjellen for å se varsler.
                    </div>
                  )}
                </Card>
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
                  deleteMember={deleteMember}
                  updateMember={updateMember}
                  markMemberInvited={markMemberInvited}
                  inviteMember={inviteMember}
                  restoreMemberByEmail={restoreMemberByEmail}
                  restoreMissingTestData={restoreMissingTestData}
                  restoreOriginalExerciseBank={restoreOriginalExerciseBank}
                  saveProgramForMember={saveProgramForMember}
                  deleteProgramById={deleteProgramById}
                  sendTrainerMessage={sendTrainerMessage}
                  saveExercise={saveExercise}
                  inviteTrainer={inviteTrainer}
                  openCustomerMessagesSignal={openCustomerMessagesSignal}
                  memberAvatarById={memberAvatarById}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
                <Card className="p-4 bg-gradient-to-b from-emerald-50/80 to-pink-50/60">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-800">Varsler</div>
                  <button
                    type="button"
                    onClick={handleMemberBellToggle}
                    className="relative rounded-xl border bg-white p-2 text-slate-700 hover:bg-emerald-50"
                    style={{ borderColor: "rgba(20,184,166,0.25)" }}
                    aria-label="Åpne varsler"
                  >
                    <Bell className="h-4 w-4" />
                    {memberUnreadCount > 0 ? (
                      <span
                        className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                        style={{ backgroundColor: MOTUS.pink }}
                      >
                        {memberUnreadCount}
                      </span>
                    ) : null}
                  </button>
                </div>
                {memberNotificationsOpen ? (
                  <div className="mt-3 space-y-2">
                    {memberVisibleAlerts.map((alert) => (
                      <button
                        key={alert.id}
                        type="button"
                        onClick={() => {
                          setMemberTab(alert.targetTab);
                          setMemberNotificationsOpen(false);
                        }}
                        className="w-full rounded-xl border bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50"
                        style={{ borderColor: "rgba(20,184,166,0.25)" }}
                      >
                        {alert.text}
                      </button>
                    ))}
                    {memberVisibleAlerts.length === 0 ? (
                      <div className="rounded-xl border border-dashed bg-white px-3 py-2 text-sm text-slate-500">
                        Ingen nye varsler akkurat nå.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-slate-500">
                    Trykk på bjellen for å se varsler.
                  </div>
                )}
              </Card>
            <MemberPortal
              members={appState.members}
              programs={appState.programs}
              logs={appState.logs}
              messages={appState.messages}
              memberViewId={appState.memberViewId}
              memberTab={memberTab}
              setMemberTab={setMemberTab}
              updateMember={updateMember}
              memberAvatarUrl={memberAvatarById[appState.memberViewId] ?? ""}
              setMemberAvatarUrl={(url) =>
                setMemberAvatarById((prev) => (url ? { ...prev, [appState.memberViewId]: url } : Object.fromEntries(Object.entries(prev).filter(([key]) => key !== appState.memberViewId))))
              }
              exercises={appState.exercises}
              sendMemberMessage={sendMemberMessage}
              workoutMode={appState.workoutMode}
              startWorkoutMode={startWorkoutMode}
              updateWorkoutExerciseResult={updateWorkoutExerciseResult}
              replaceWorkoutExerciseGroup={replaceWorkoutExerciseGroup}
              updateWorkoutModeNote={updateWorkoutModeNote}
              finishWorkoutMode={finishWorkoutMode}
              cancelWorkoutMode={cancelWorkoutMode}
              workoutCelebration={appState.workoutCelebration}
              dismissWorkoutCelebration={dismissWorkoutCelebration}
            />
            </div>
          )}

          <div className="fixed inset-x-0 bottom-0 z-[9999] border-t bg-white/95 px-2 pt-2 backdrop-blur md:hidden" style={{ borderColor: "rgba(15,23,42,0.08)", paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}>
            <div className="mx-auto flex max-w-md items-center gap-1.5 rounded-[22px] border bg-slate-50/90 p-1.5 shadow-lg" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
              {appState.role === "trainer" ? (
                <>
                  <div
                    className="flex w-full items-center gap-1.5 rounded-[18px] p-1.5"
                    style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                  >
                    {[
                      { id: "dashboard", label: "Oversikt", icon: <LayoutDashboard className="h-4 w-4" /> },
                      { id: "customers", label: "Klienter", icon: <Users className="h-4 w-4" /> },
                      { id: "programs", label: "Program", icon: <ClipboardList className="h-4 w-4" /> },
                      { id: "exerciseBank", label: "Øvelser", icon: <Dumbbell className="h-4 w-4" /> },
                      { id: "messages", label: "Meldinger", icon: <MessageSquare className="h-4 w-4" /> },
                      { id: "admin", label: "Admin", icon: <ShieldCheck className="h-4 w-4" /> },
                    ].map((tab) => {
                      const isActive = trainerTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setTrainerTab(tab.id as typeof trainerTab)}
                          className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition ${
                            isActive ? "bg-white text-slate-900 shadow-sm" : "bg-white/20 text-white hover:bg-white/30"
                          }`}
                        >
                          {tab.icon}
                          <span className="truncate">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="flex w-full items-center gap-1.5 rounded-[18px] p-1.5"
                    style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                  >
                    {[
                      { id: "overview", label: "Hjem", icon: <LayoutDashboard className="h-4 w-4" /> },
                      { id: "programs", label: "Program", icon: <ClipboardList className="h-4 w-4" /> },
                      { id: "progress", label: "Fremgang", icon: <TrendingUp className="h-4 w-4" /> },
                      { id: "messages", label: "Meldinger", icon: <MessageSquare className="h-4 w-4" /> },
                      { id: "profile", label: "Profil", icon: <UserCircle2 className="h-4 w-4" /> },
                    ].map((tab) => {
                      const isActive = memberTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setMemberTab(tab.id as typeof memberTab)}
                          className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition ${
                            isActive ? "bg-white text-slate-900 shadow-sm" : "bg-white/20 text-white hover:bg-white/30"
                          }`}
                        >
                          {tab.icon}
                          <span className="truncate">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { ComponentProps, Dispatch, SetStateAction } from "react";
import { BarChart3, Bell, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, Clock3, Dumbbell, LayoutDashboard, MessageSquare, Settings, ShieldCheck, UserPlus, Users, type LucideIcon } from "lucide-react";
import { MOTUS } from "../app/data";
import type { AppState, TrainerTab } from "../app/types";
import { Card } from "../app/ui";
import { TrainerPortal } from "./TrainerPortal";

type TrainerAlert = {
  id: string;
  memberId: string;
  title: string;
  text: string;
  detail: string;
  timestamp: number;
};

type TrainerLayoutProps = {
  appState: AppState;
  trainerTab: ComponentProps<typeof TrainerPortal>["trainerTab"];
  setTrainerTab: ComponentProps<typeof TrainerPortal>["setTrainerTab"];
  patchState: (patch: Partial<AppState>) => void;
  addMember: ComponentProps<typeof TrainerPortal>["addMember"];
  deactivateMember: ComponentProps<typeof TrainerPortal>["deactivateMember"];
  deleteMember: ComponentProps<typeof TrainerPortal>["deleteMember"];
  updateMember: ComponentProps<typeof TrainerPortal>["updateMember"];
  markMemberInvited: ComponentProps<typeof TrainerPortal>["markMemberInvited"];
  inviteMember: ComponentProps<typeof TrainerPortal>["inviteMember"];
  inviteTrainer: ComponentProps<typeof TrainerPortal>["inviteTrainer"];
  restoreMemberByEmail: ComponentProps<typeof TrainerPortal>["restoreMemberByEmail"];
  restoreMissingTestData: ComponentProps<typeof TrainerPortal>["restoreMissingTestData"];
  restoreOriginalExerciseBank: ComponentProps<typeof TrainerPortal>["restoreOriginalExerciseBank"];
  saveProgramForMember: ComponentProps<typeof TrainerPortal>["saveProgramForMember"];
  deleteProgramById: ComponentProps<typeof TrainerPortal>["deleteProgramById"];
  sendTrainerMessage: ComponentProps<typeof TrainerPortal>["sendTrainerMessage"];
  updateWorkoutLogTrainerComment?: ComponentProps<typeof TrainerPortal>["updateWorkoutLogTrainerComment"];
  clearLocalChatCache: ComponentProps<typeof TrainerPortal>["clearLocalChatCache"];
  saveExercise: ComponentProps<typeof TrainerPortal>["saveExercise"];
  deleteExercise: ComponentProps<typeof TrainerPortal>["deleteExercise"];
  openCustomerMessagesSignal: number;
  setOpenCustomerMessagesSignal: Dispatch<SetStateAction<number>>;
  memberAvatarById: Record<string, string>;
  setMemberAvatarUrlForMember: ComponentProps<typeof TrainerPortal>["setMemberAvatarUrlForMember"];
  trainerNotificationsOpen: boolean;
  setTrainerNotificationsOpen: (open: boolean) => void;
  trainerUnreadCount: number;
  trainerMessageAlerts: TrainerAlert[];
  handleTrainerBellToggle: () => void;
  isLocalDemoSession: boolean;
  remoteTrainerPeriodPlansByMemberId: ComponentProps<typeof TrainerPortal>["remoteTrainerPeriodPlansByMemberId"];
};

const trainerMenuItems: Array<{ key: TrainerTab; label: string; icon: LucideIcon }> = [
  { key: "dashboard", label: "Oversikt", icon: LayoutDashboard },
  { key: "customers", label: "Klienter", icon: Users },
  { key: "exerciseBank", label: "Øvelsesbank", icon: Dumbbell },
  { key: "programs", label: "Programmer", icon: ClipboardList },
  { key: "calendar", label: "Kalender", icon: CalendarDays },
  { key: "statistics", label: "Statistikk", icon: BarChart3 },
  { key: "settings", label: "Innstillinger", icon: Settings },
  { key: "admin", label: "Admin", icon: ShieldCheck },
];

const mobileTabs: Array<{ id: TrainerTab; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Oversikt", icon: LayoutDashboard },
  { id: "customers", label: "Kunder", icon: Users },
  { id: "programs", label: "Program", icon: ClipboardList },
  { id: "exerciseBank", label: "Øvelser", icon: Dumbbell },
];

export function TrainerLayout({
  appState,
  trainerTab,
  setTrainerTab,
  patchState,
  addMember,
  deactivateMember,
  deleteMember,
  updateMember,
  markMemberInvited,
  inviteMember,
  inviteTrainer,
  restoreMemberByEmail,
  restoreMissingTestData,
  restoreOriginalExerciseBank,
  saveProgramForMember,
  deleteProgramById,
  sendTrainerMessage,
  updateWorkoutLogTrainerComment,
  clearLocalChatCache,
  saveExercise,
  deleteExercise,
  openCustomerMessagesSignal,
  setOpenCustomerMessagesSignal,
  memberAvatarById,
  setMemberAvatarUrlForMember,
  trainerNotificationsOpen,
  setTrainerNotificationsOpen,
  trainerUnreadCount,
  trainerMessageAlerts,
  handleTrainerBellToggle,
  isLocalDemoSession,
  remoteTrainerPeriodPlansByMemberId,
}: TrainerLayoutProps) {
  const canAccessAdminTools = true;
  const missingInviteMemberIds = useMemo(
    () =>
      appState.members
        .filter((member) => !member.invitedAt)
        .map((member) => member.id)
        .sort(),
    [appState.members],
  );
  const inactiveMemberIds = useMemo(
    () =>
      appState.members
        .filter((member) => Number(member.daysSinceActivity || "0") >= 7)
        .map((member) => member.id)
        .sort(),
    [appState.members],
  );
  const inactiveMembersCount = inactiveMemberIds.length;
  const missingInvitesCount = missingInviteMemberIds.length;
  const trainerOperationalAlertKey = `${missingInviteMemberIds.join(",")}|${inactiveMemberIds.join(",")}`;
  const [seenTrainerOperationalAlertKey, setSeenTrainerOperationalAlertKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("motus.notifications.trainerOperationalSeenKey") ?? "";
  });
  const hasTrainerOperationalAlerts = missingInvitesCount + inactiveMembersCount > 0;
  const hasUnseenTrainerOperationalAlerts =
    hasTrainerOperationalAlerts && trainerOperationalAlertKey !== seenTrainerOperationalAlertKey;
  const trainerActionCount =
    trainerUnreadCount +
    (trainerNotificationsOpen || hasUnseenTrainerOperationalAlerts ? missingInvitesCount + inactiveMembersCount : 0);
  const visibleTrainerMenuItems = trainerMenuItems;
  const visibleMobileTabs = mobileTabs;

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.notifications.trainerOperationalSeenKey", seenTrainerOperationalAlertKey);
  }, [seenTrainerOperationalAlertKey]);

  function handleTrainerActionPanelToggle() {
    const willOpen = !trainerNotificationsOpen;
    handleTrainerBellToggle();
    if (willOpen && hasTrainerOperationalAlerts) {
      setSeenTrainerOperationalAlertKey(trainerOperationalAlertKey);
    }
  }

  const trainerPortalProps: ComponentProps<typeof TrainerPortal> = {
    members: appState.members,
    programs: appState.programs,
    logs: appState.logs,
    messages: appState.messages,
    exercises: appState.exercises,
    selectedMemberId: appState.selectedMemberId,
    setSelectedMemberId: (id) => patchState({ selectedMemberId: id }),
    trainerTab,
    setTrainerTab,
    addMember,
    deactivateMember,
    deleteMember,
    updateMember,
    markMemberInvited,
    inviteMember,
    restoreMemberByEmail,
    restoreMissingTestData,
    restoreOriginalExerciseBank,
    saveProgramForMember,
    deleteProgramById,
    sendTrainerMessage,
    updateWorkoutLogTrainerComment,
    clearLocalChatCache,
    saveExercise,
    deleteExercise,
    inviteTrainer,
    openCustomerMessagesSignal,
    memberAvatarById,
    setMemberAvatarUrlForMember,
    isLocalDemoSession,
    canAccessAdminTools,
    remoteTrainerPeriodPlansByMemberId,
    trainerAccountName: appState.currentUser?.name?.trim() ?? "",
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card className="hidden h-fit p-3 shadow-sm ring-1 ring-black/5 lg:block">
          <div className="mb-2 px-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">PT-meny</div>
          </div>
          <nav aria-label="Hovedmeny trener" className="space-y-1.5">
            {visibleTrainerMenuItems.map((item) => {
              const Icon = item.icon;
              return (
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
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </Card>
        <div className="space-y-4 sm:space-y-5">
          {isLocalDemoSession ? (
            <Card className="border-amber-200 bg-amber-50 p-2.5 sm:p-3">
              <div className="text-xs sm:text-sm font-semibold text-amber-900">Demo-innlogging aktiv</div>
              <div className="mt-1 text-xs sm:text-sm text-amber-800">
                Data lagres kun lokalt i denne sesjonen. Logg inn med ekte konto for synk mot medlemssiden.
              </div>
            </Card>
          ) : null}
          <Card className="bg-gradient-to-br from-emerald-50/90 via-white to-pink-50/70 p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aktuelt nå</div>
                <div className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {trainerActionCount > 0 ? (
                    <>
                      <span>{trainerActionCount} ting å følge opp</span>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: MOTUS.pink }} />
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>Alt er ajour</span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleTrainerActionPanelToggle}
                className="relative inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-emerald-50"
                style={{ borderColor: "rgba(20,184,166,0.25)" }}
                aria-label={trainerNotificationsOpen ? "Lukk varsler" : "Åpne varsler"}
              >
                <Bell className="h-4 w-4" />
                <span>{trainerNotificationsOpen ? "Lukk" : "Se"}</span>
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
              <div className="mt-3 max-h-64 overflow-y-auto space-y-2 pr-1">
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
                    className="group flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50"
                    style={{ borderColor: "rgba(20,184,166,0.25)" }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <MessageSquare className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{alert.text}</span>
                      <span className="block truncate text-xs text-slate-500">{alert.detail || "Åpne meldinger"}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-emerald-500" />
                  </button>
                ))}
                {missingInvitesCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTrainerTab("customers");
                      setTrainerNotificationsOpen(false);
                    }}
                    className="group flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50"
                    style={{ borderColor: "rgba(20,184,166,0.25)" }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-600">
                      <UserPlus className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{missingInvitesCount} kunder mangler invitasjon</span>
                      <span className="block truncate text-xs text-slate-500">Gå til klienter og send invitasjon.</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-emerald-500" />
                  </button>
                ) : null}
                {inactiveMembersCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTrainerTab("customers");
                      setTrainerNotificationsOpen(false);
                    }}
                    className="group flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50"
                    style={{ borderColor: "rgba(20,184,166,0.25)" }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                      <Clock3 className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{inactiveMembersCount} kunder bør følges opp</span>
                      <span className="block truncate text-xs text-slate-500">Åpne klientlisten og prioriter oppfølging.</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-emerald-500" />
                  </button>
                ) : null}
                {!trainerMessageAlerts.length && !missingInvitesCount && !inactiveMembersCount ? (
                  <div className="rounded-xl border border-dashed bg-white px-3 py-2.5 text-sm text-slate-500">
                    Ingen nye ting å følge opp akkurat nå.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-2 text-xs sm:text-sm text-slate-500">
                {trainerActionCount > 0 ? "Åpne for raske snarveier til meldinger og klientoppfølging." : "Nye meldinger og oppfølginger samles her."}
              </div>
            )}
          </Card>
          {canAccessAdminTools ? (
            <button
              type="button"
              onClick={() => setTrainerTab("admin")}
              className="flex w-full items-center justify-between rounded-xl border bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
              style={{ borderColor: "rgba(15,23,42,0.08)" }}
            >
              <span className="inline-flex items-center gap-2">
                <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span>Adminverktøy</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          ) : null}
          <TrainerPortal {...trainerPortalProps} />
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-[9999] overflow-x-hidden border-t bg-white/95 px-1 pt-1 backdrop-blur lg:hidden"
        style={{ borderColor: "rgba(15,23,42,0.08)", paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
      >
        <div
          className="mx-auto flex w-[min(100%,22rem)] items-center gap-0.5 rounded-[18px] border bg-slate-50/90 p-0.5 shadow-lg"
          style={{ borderColor: "rgba(15,23,42,0.06)" }}
        >
          <div
            className="grid w-full grid-cols-4 items-center gap-0.5 rounded-[14px] p-0.5"
            style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
          >
            {visibleMobileTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = trainerTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTrainerTab(tab.id)}
                  className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1.5 text-[9px] font-semibold transition ${
                    isActive ? "bg-white text-slate-900 shadow-sm" : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

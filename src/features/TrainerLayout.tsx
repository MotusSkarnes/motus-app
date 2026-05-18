import { useState, type ComponentProps, type Dispatch, type SetStateAction } from "react";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  ClipboardPenLine,
  Clock3,
  Dumbbell,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { MOTUS } from "../app/data";
import { formatNotificationTimestamp } from "../app/dateFormat";
import type { AppState, TrainerTab } from "../app/types";
import { Card } from "../app/ui";
import type { TrainerAlert } from "../app/useNotifications";
import { TrainerPortal } from "./TrainerPortal";
import type { MemberPortal } from "./MemberPortal";
import { InspirationHub } from "./InspirationHub";

type TrainerWorkoutBridge = Pick<
  ComponentProps<typeof MemberPortal>,
  | "workoutMode"
  | "startWorkoutMode"
  | "updateWorkoutExerciseResult"
  | "replaceWorkoutExerciseGroup"
  | "appendWorkoutSetForProgramExercise"
  | "deferWorkoutExerciseGroup"
  | "updateWorkoutModeNote"
  | "updateWorkoutExerciseNote"
  | "finishWorkoutMode"
  | "cancelWorkoutMode"
>;

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
  openCustomerOverviewSignal: number;
  setOpenCustomerOverviewSignal: Dispatch<SetStateAction<number>>;
  memberAvatarById: Record<string, string>;
  setMemberAvatarUrlForMember: ComponentProps<typeof TrainerPortal>["setMemberAvatarUrlForMember"];
  trainerNotificationsOpen: boolean;
  setTrainerNotificationsOpen: (open: boolean) => void;
  trainerUnreadCount: number;
  trainerVisibleAlerts: TrainerAlert[];
  openTrainerAlert: (alert: TrainerAlert) => void;
  handleTrainerBellToggle: () => void;
  isLocalDemoSession: boolean;
  remoteTrainerPeriodPlansByMemberId: ComponentProps<typeof TrainerPortal>["remoteTrainerPeriodPlansByMemberId"];
} & TrainerWorkoutBridge;

const trainerMenuItems: Array<{ key: TrainerTab; label: string; icon: LucideIcon }> = [
  { key: "dashboard", label: "Oversikt", icon: LayoutDashboard },
  { key: "customers", label: "Klienter", icon: Users },
  { key: "exerciseBank", label: "Øvelsesbank", icon: Dumbbell },
  { key: "programs", label: "Programmer", icon: ClipboardList },
  { key: "inspiration", label: "Inspirasjon", icon: Sparkles },
  { key: "settings", label: "Innstillinger", icon: Settings },
  { key: "admin", label: "Admin", icon: ShieldCheck },
];

const mobileTabs: Array<{ id: TrainerTab; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Oversikt", icon: LayoutDashboard },
  { id: "customers", label: "Kunder", icon: Users },
  { id: "programs", label: "Program", icon: ClipboardList },
  { id: "inspiration", label: "Inspo", icon: Sparkles },
  { id: "exerciseBank", label: "Øvelser", icon: Dumbbell },
];

const mobileMoreTabs: Array<{ id: TrainerTab; label: string; icon: LucideIcon }> = [
  { id: "settings", label: "Innstillinger", icon: Settings },
  { id: "admin", label: "Admin", icon: ShieldCheck },
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
  openCustomerOverviewSignal,
  setOpenCustomerOverviewSignal,
  memberAvatarById,
  setMemberAvatarUrlForMember,
  trainerNotificationsOpen,
  setTrainerNotificationsOpen,
  trainerUnreadCount,
  trainerVisibleAlerts,
  openTrainerAlert,
  handleTrainerBellToggle,
  isLocalDemoSession,
  remoteTrainerPeriodPlansByMemberId,
  workoutMode,
  startWorkoutMode,
  updateWorkoutExerciseResult,
  replaceWorkoutExerciseGroup,
  appendWorkoutSetForProgramExercise,
  deferWorkoutExerciseGroup,
  updateWorkoutModeNote,
  updateWorkoutExerciseNote,
  finishWorkoutMode,
  cancelWorkoutMode,
}: TrainerLayoutProps) {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const canAccessAdminTools = true;
  const visibleTrainerMenuItems = trainerMenuItems;
  const visibleMobileTabs = mobileTabs;
  const isMoreTabActive = mobileMoreTabs.some((tab) => tab.id === trainerTab);

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
    openCustomerOverviewSignal,
    memberAvatarById,
    setMemberAvatarUrlForMember,
    isLocalDemoSession,
    canAccessAdminTools,
    remoteTrainerPeriodPlansByMemberId,
    trainerAccountName: appState.currentUser?.name?.trim() ?? "",
    workoutMode,
    startWorkoutMode,
    updateWorkoutExerciseResult,
    replaceWorkoutExerciseGroup,
    appendWorkoutSetForProgramExercise,
    deferWorkoutExerciseGroup,
    updateWorkoutModeNote,
    updateWorkoutExerciseNote,
    finishWorkoutMode,
    cancelWorkoutMode,
  };

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
        <Card className="hidden h-fit p-3 shadow-sm ring-1 ring-black/5 xl:block">
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
        <div className="min-w-0 space-y-4 overflow-x-hidden sm:space-y-5">
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
                  {trainerUnreadCount > 0 ? (
                    <>
                      <span>{trainerUnreadCount} ting å følge opp</span>
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
                onClick={handleTrainerBellToggle}
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
              <div className="mt-3 max-h-[min(22rem,70vh)] overflow-y-auto space-y-2 pr-1">
                {trainerVisibleAlerts.map((alert) => {
                  const AlertIcon =
                    alert.kind === "message"
                      ? MessageSquare
                      : alert.kind === "member-form"
                        ? ClipboardPenLine
                        : alert.kind === "missing-invite"
                          ? UserPlus
                          : Clock3;
                  const isOpened = alert.isOpened;
                  const isUnread = alert.isUnread && !isOpened;
                  const isRead = !isUnread;
                  const receivedAt = formatNotificationTimestamp(alert.timestamp);
                  return (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => openTrainerAlert(alert)}
                      className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left shadow-sm transition ${
                        isOpened
                          ? "border-slate-200/80 bg-slate-50/90 opacity-75 hover:bg-slate-100"
                          : isUnread
                            ? "border-pink-200/90 bg-pink-50/40 hover:-translate-y-0.5 hover:bg-pink-50/70"
                            : isRead
                              ? "border-slate-200/90 bg-slate-50/70 opacity-90 hover:bg-slate-100"
                              : "border-emerald-200/80 bg-white hover:-translate-y-0.5 hover:bg-emerald-50"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          alert.kind === "missing-invite"
                            ? isOpened || isRead
                              ? "bg-slate-100 text-slate-400"
                              : "bg-pink-50 text-pink-600"
                            : alert.kind === "inactive-member"
                              ? isOpened || isRead
                                ? "bg-slate-100 text-slate-400"
                                : "bg-amber-50 text-amber-600"
                              : isUnread
                                ? "bg-pink-100 text-pink-700"
                                : isOpened || isRead
                                  ? "bg-slate-100 text-slate-400"
                                  : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        <AlertIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className={`block text-sm ${
                              isOpened
                                ? "font-medium text-slate-500"
                                : isUnread
                                  ? "font-semibold text-slate-900"
                                  : isRead
                                    ? "font-medium text-slate-600"
                                    : "font-semibold text-slate-800"
                            }`}
                          >
                            {alert.text}
                          </span>
                          {isUnread ? (
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                              style={{ backgroundColor: MOTUS.pink }}
                            >
                              Ny
                            </span>
                          ) : null}
                        </span>
                        <span className={`block truncate text-xs ${isOpened ? "text-slate-400" : "text-slate-500"}`}>
                          {alert.detail}
                        </span>
                        {receivedAt ? (
                          <span className={`mt-0.5 block text-[11px] ${isUnread ? "font-medium text-pink-700/80" : "text-slate-400"}`}>
                            {receivedAt}
                          </span>
                        ) : null}
                      </span>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 transition ${
                          isOpened ? "text-slate-300" : "text-slate-300 group-hover:text-emerald-500"
                        }`}
                      />
                    </button>
                  );
                })}
                {trainerVisibleAlerts.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-white px-3 py-2.5 text-sm text-slate-500">
                    Ingen nye ting å følge opp akkurat nå.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-2 text-xs sm:text-sm text-slate-500">
                {trainerUnreadCount > 0 ? "Åpne for raske snarveier til meldinger og klientoppfølging." : "Nye meldinger og oppfølginger samles her."}
              </div>
            )}
          </Card>
          {trainerTab === "inspiration" ? (
            <InspirationHub
              canManage
              authorName={appState.currentUser?.name ?? "Motus"}
              exerciseBank={appState.exercises}
              programTemplates={appState.programs
                .filter((program) => program.memberId === "__template__")
                .map((program) => ({ id: program.id, title: program.title }))}
            />
          ) : (
            <TrainerPortal {...trainerPortalProps} />
          )}
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-[9999] border-t bg-white/95 px-2 pt-2 backdrop-blur xl:hidden"
        style={{ borderColor: "rgba(15,23,42,0.08)", paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
      >
        {moreMenuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-[9998] cursor-default bg-slate-900/20"
            aria-label="Lukk meny"
            onClick={() => setMoreMenuOpen(false)}
          />
        ) : null}
        {moreMenuOpen ? (
          <div
            className="absolute bottom-full left-2 right-2 z-[10000] mb-2 overflow-hidden rounded-2xl border bg-white shadow-xl"
            style={{ borderColor: "rgba(15,23,42,0.1)" }}
            role="menu"
          >
            {mobileMoreTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = trainerTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setTrainerTab(tab.id);
                    setMoreMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left text-sm font-medium last:border-b-0 ${
                    isActive ? "bg-teal-50 text-teal-900" : "text-slate-700 hover:bg-slate-50"
                  }`}
                  style={{ borderColor: "rgba(15,23,42,0.06)" }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        ) : null}
        <div
          className="relative z-[10001] mx-auto flex max-w-lg items-center gap-1.5 rounded-[22px] border bg-slate-50/90 p-1.5 shadow-lg"
          style={{ borderColor: "rgba(15,23,42,0.06)" }}
        >
          <div
            className="flex w-full items-center gap-1 rounded-[18px] p-1"
            style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
          >
            {visibleMobileTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = trainerTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setTrainerTab(tab.id);
                  }}
                  className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition ${
                    isActive ? "bg-white text-slate-900 shadow-sm" : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMoreMenuOpen((open) => !open)}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition ${
                isMoreTabActive || moreMenuOpen ? "bg-white text-slate-900 shadow-sm" : "bg-white/20 text-white hover:bg-white/30"
              }`}
              aria-expanded={moreMenuOpen}
              aria-haspopup="menu"
            >
              <MoreHorizontal className="h-4 w-4 shrink-0" />
              <span>Mer</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

import { useState, type ComponentProps, type Dispatch, type SetStateAction } from "react";
import {
  Apple,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  FileText,
  Home,
  MessageSquare,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { MOTUS } from "../app/data";
import type { AppState, AuthUser, TrainerTab } from "../app/types";
import { Card } from "../app/ui";
import { TrainerPortal } from "./TrainerPortal";
import type { MemberPortal } from "./MemberPortal";
import { TrainerFoodBankView } from "./TrainerFoodBankView";
import { InspirationHub } from "./InspirationHub";
import { TrainerBadgeCatalog } from "./TrainerBadgeCatalog";

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

type TrainerNavAction = "messages" | "calendar";

type TrainerMenuItem = {
  key: TrainerTab;
  label: string;
  icon: LucideIcon;
  badge?: number;
  action?: TrainerNavAction;
};

type TrainerLayoutProps = {
  appState: AppState;
  trainerTab: ComponentProps<typeof TrainerPortal>["trainerTab"];
  setTrainerTab: ComponentProps<typeof TrainerPortal>["setTrainerTab"];
  patchState: (patch: Partial<AppState>) => void;
  messageBadgeCount?: number;
  addMember: ComponentProps<typeof TrainerPortal>["addMember"];
  deactivateMember: ComponentProps<typeof TrainerPortal>["deactivateMember"];
  deleteMember: ComponentProps<typeof TrainerPortal>["deleteMember"];
  updateMember: ComponentProps<typeof TrainerPortal>["updateMember"];
  markMemberInvited: ComponentProps<typeof TrainerPortal>["markMemberInvited"];
  inviteMember: ComponentProps<typeof TrainerPortal>["inviteMember"];
  inviteTrainer: ComponentProps<typeof TrainerPortal>["inviteTrainer"];
  restoreMemberByEmail: ComponentProps<typeof TrainerPortal>["restoreMemberByEmail"];
  reassignMemberOwner: ComponentProps<typeof TrainerPortal>["reassignMemberOwner"];
  restoreMissingTestData: ComponentProps<typeof TrainerPortal>["restoreMissingTestData"];
  restoreOriginalExerciseBank: ComponentProps<typeof TrainerPortal>["restoreOriginalExerciseBank"];
  saveProgramForMember: ComponentProps<typeof TrainerPortal>["saveProgramForMember"];
  deleteProgramById: ComponentProps<typeof TrainerPortal>["deleteProgramById"];
  sendTrainerMessage: ComponentProps<typeof TrainerPortal>["sendTrainerMessage"];
  toggleChatMessageReaction: ComponentProps<typeof TrainerPortal>["toggleChatMessageReaction"];
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
  isLocalDemoSession: boolean;
  remoteTrainerPeriodPlansByMemberId: ComponentProps<typeof TrainerPortal>["remoteTrainerPeriodPlansByMemberId"];
  applyTrainerProfileSaved: (user: AuthUser) => void;
} & TrainerWorkoutBridge;

function buildTrainerMenuItems(messageBadgeCount: number, includeAdmin: boolean): TrainerMenuItem[] {
  const items: TrainerMenuItem[] = [
    { key: "dashboard", label: "Hjem", icon: Home },
    { key: "customers", label: "Klienter", icon: Users },
    { key: "programs", label: "Programmer", icon: ClipboardList },
    { key: "exerciseBank", label: "Øvelsesbank", icon: Dumbbell },
    { key: "inspiration", label: "Innhold", icon: FileText },
    { key: "nutrition", label: "Ernæring", icon: Apple },
    { key: "customers", label: "Meldinger", icon: MessageSquare, badge: messageBadgeCount, action: "messages" },
    { key: "calendar", label: "Kalender", icon: CalendarDays },
    { key: "statistics", label: "Statistikk", icon: BarChart3 },
    { key: "settings", label: "Innstillinger", icon: Settings },
  ];
  if (includeAdmin) {
    items.push({ key: "admin", label: "Admin", icon: ShieldCheck });
  }
  return items;
}

const mobileTabs: Array<{ id: TrainerTab; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Hjem", icon: Home },
  { id: "customers", label: "Klienter", icon: Users },
  { id: "programs", label: "Program", icon: ClipboardList },
  { id: "inspiration", label: "Innhold", icon: FileText },
  { id: "exerciseBank", label: "Øvelser", icon: Dumbbell },
];

const mobileMoreTabs: Array<{ id: TrainerTab; label: string; icon: LucideIcon }> = [
  { id: "calendar", label: "Kalender", icon: CalendarDays },
  { id: "nutrition", label: "Ernæring", icon: Apple },
  { id: "statistics", label: "Statistikk", icon: BarChart3 },
  { id: "settings", label: "Innstillinger", icon: Settings },
  { id: "admin", label: "Admin", icon: ShieldCheck },
];

function isNavItemActive(item: TrainerMenuItem, trainerTab: TrainerTab): boolean {
  if (item.action) return false;
  return trainerTab === item.key;
}

export function TrainerLayout({
  appState,
  trainerTab,
  setTrainerTab,
  patchState,
  messageBadgeCount = 0,
  addMember,
  deactivateMember,
  deleteMember,
  updateMember,
  markMemberInvited,
  inviteMember,
  inviteTrainer,
  restoreMemberByEmail,
  reassignMemberOwner,
  restoreMissingTestData,
  restoreOriginalExerciseBank,
  saveProgramForMember,
  deleteProgramById,
  sendTrainerMessage,
  toggleChatMessageReaction,
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
  isLocalDemoSession,
  remoteTrainerPeriodPlansByMemberId,
  applyTrainerProfileSaved,
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
  const trainerMenuItems = buildTrainerMenuItems(messageBadgeCount, canAccessAdminTools);
  const visibleMobileTabs = mobileTabs;
  const isMoreTabActive = mobileMoreTabs.some((tab) => tab.id === trainerTab);

  const handleNavClick = (item: TrainerMenuItem) => {
    if (item.action === "messages") {
      setTrainerTab("customers");
      setOpenCustomerMessagesSignal((value) => value + 1);
      return;
    }
    setTrainerTab(item.key);
  };

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
    onSwitchToMemberView: () =>
      patchState((prev) => {
        const memberId = prev.selectedMemberId.trim() || prev.memberViewId.trim();
        return {
          role: "member",
          ...(memberId ? { memberViewId: memberId, selectedMemberId: memberId } : {}),
        };
      }),
    addMember,
    deactivateMember,
    deleteMember,
    updateMember,
    markMemberInvited,
    inviteMember,
    restoreMemberByEmail,
    reassignMemberOwner,
    restoreMissingTestData,
    restoreOriginalExerciseBank,
    saveProgramForMember,
    deleteProgramById,
    sendTrainerMessage,
    toggleChatMessageReaction,
    updateWorkoutLogTrainerComment,
    clearLocalChatCache,
    saveExercise,
    deleteExercise,
    inviteTrainer,
    openCustomerMessagesSignal,
    setOpenCustomerMessagesSignal,
    openCustomerOverviewSignal,
    memberAvatarById,
    setMemberAvatarUrlForMember,
    isLocalDemoSession,
    canAccessAdminTools,
    remoteTrainerPeriodPlansByMemberId,
    trainerAccountName: appState.currentUser?.name?.trim() ?? "",
    onTrainerProfileSaved: applyTrainerProfileSaved,
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
      <div className="motus-trainer-shell grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="motus-trainer-nav h-fit overflow-hidden border-0 bg-[#f7f9fb] p-0 shadow-sm ring-1 ring-black/5 xl:col-start-1">
          <nav aria-label="Hovedmeny trener" className="motus-trainer-nav-list">
            {trainerMenuItems.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(item, trainerTab);
              const navKey = `${item.key}-${item.label}`;
              return (
                <button
                  key={navKey}
                  type="button"
                  onClick={() => handleNavClick(item)}
                  className={`motus-trainer-nav-item ${active ? "motus-trainer-nav-item--active" : ""}`}
                >
                  <Icon className="motus-trainer-nav-icon h-[18px] w-[18px] shrink-0" aria-hidden />
                  <span className="motus-trainer-nav-text">{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="motus-trainer-nav-badge">{item.badge > 9 ? "9+" : item.badge}</span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </Card>
        <div className="motus-trainer-main min-w-0 space-y-4 sm:space-y-5 xl:col-start-2">
          {isLocalDemoSession ? (
            <Card className="border-amber-200 bg-amber-50 p-2.5 sm:p-3">
              <div className="text-xs sm:text-sm font-semibold text-amber-900">Demo-innlogging aktiv</div>
              <div className="mt-1 text-xs sm:text-sm text-amber-800">
                Data lagres kun lokalt i denne sesjonen. Logg inn med ekte konto for synk mot medlemssiden.
              </div>
            </Card>
          ) : null}
          <div className={trainerTab === "dashboard" ? "pb-[calc(5rem+env(safe-area-inset-bottom,0px))] xl:pb-0" : undefined}>
            {trainerTab === "inspiration" ? (
              <InspirationHub
                canManage
                authorName={appState.currentUser?.name ?? "Motus"}
                exerciseBank={appState.exercises}
                programTemplates={appState.programs
                  .filter((program) => program.memberId === "__template__")
                  .map((program) => ({ id: program.id, title: program.title }))}
              />
            ) : trainerTab === "nutrition" ? (
              <TrainerFoodBankView trainerName={appState.currentUser?.name ?? "Motus PT"} />
            ) : trainerTab === "badges" ? (
              <TrainerBadgeCatalog />
            ) : (
              <TrainerPortal {...trainerPortalProps} />
            )}
          </div>
        </div>
      </div>

      <div className="motus-mobile-tab-bar fixed inset-x-0 bottom-0 z-[10001] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 xl:hidden">
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
            className="absolute bottom-full left-2 right-2 z-[10000] mb-2 overflow-hidden rounded-2xl border bg-white shadow-lg"
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
        <div className="motus-mobile-tab-bar-inner relative z-[10001] mx-auto flex max-w-lg items-stretch gap-0.5">
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
                className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-semibold transition ${
                  isActive ? "motus-mobile-tab-active" : "text-slate-400"
                }`}
              >
                <Icon
                  className={`shrink-0 ${isActive ? "h-6 w-6" : "h-[22px] w-[22px]"}`}
                  strokeWidth={isActive ? 2.5 : 2}
                  style={isActive ? { color: MOTUS.turquoise } : undefined}
                />
                <span className="truncate leading-none">{tab.label}</span>
                {isActive ? (
                  <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: MOTUS.turquoise }} aria-hidden />
                ) : (
                  <span className="h-0.5 w-4" aria-hidden />
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreMenuOpen((open) => !open)}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-semibold transition ${
              isMoreTabActive || moreMenuOpen
                ? "motus-mobile-tab-active rounded-xl bg-white/70 shadow-[0_1px_4px_-2px_rgba(15,23,42,0.12)]"
                : "text-slate-500"
            }`}
            aria-expanded={moreMenuOpen}
            aria-haspopup="menu"
          >
            <MoreHorizontal
              className="h-[22px] w-[22px] shrink-0"
              strokeWidth={isMoreTabActive || moreMenuOpen ? 2.5 : 2}
              style={isMoreTabActive || moreMenuOpen ? { color: MOTUS.turquoise } : undefined}
            />
            <span className="leading-none">Mer</span>
            {isMoreTabActive || moreMenuOpen ? (
              <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: MOTUS.turquoise }} aria-hidden />
            ) : (
              <span className="h-0.5 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </>
  );
}

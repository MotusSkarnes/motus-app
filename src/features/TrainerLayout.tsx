import { useState, type ComponentProps, type Dispatch, type SetStateAction } from "react";
import {
  ClipboardList,
  Dumbbell,
  Award,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { MOTUS } from "../app/data";
import type { AppState, AuthUser, TrainerTab } from "../app/types";
import { Card } from "../app/ui";
import { TrainerPortal } from "./TrainerPortal";
import type { MemberPortal } from "./MemberPortal";
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

const trainerMenuItems: Array<{ key: TrainerTab; label: string; icon: LucideIcon }> = [
  { key: "dashboard", label: "Oversikt", icon: LayoutDashboard },
  { key: "customers", label: "Klienter", icon: Users },
  { key: "exerciseBank", label: "Øvelsesbank", icon: Dumbbell },
  { key: "programs", label: "Programmer", icon: ClipboardList },
  { key: "inspiration", label: "Inspirasjon", icon: Sparkles },
  { key: "badges", label: "Badges", icon: Award },
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
  { id: "badges", label: "Badges", icon: Award },
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
      <div className="motus-trainer-shell grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
        <Card className="motus-trainer-nav hidden h-fit overflow-hidden border-0 bg-[#F7F8FA] p-1 shadow-sm ring-1 ring-black/5 xl:block">
          <div className="mb-1 px-2 pt-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">PT-meny</div>
          </div>
          <nav aria-label="Hovedmeny trener" className="space-y-1 px-1 pb-1">
            {visibleTrainerMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTrainerTab(item.key)}
                  className={`motus-trainer-nav-item w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold whitespace-nowrap transition ${
                    trainerTab === item.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="motus-trainer-nav-icon h-4 w-4" />
                    <span className="motus-trainer-nav-text">{item.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </Card>
        <div className="min-w-0 space-y-4 sm:space-y-5">
          {isLocalDemoSession ? (
            <Card className="border-amber-200 bg-amber-50 p-2.5 sm:p-3">
              <div className="text-xs sm:text-sm font-semibold text-amber-900">Demo-innlogging aktiv</div>
              <div className="mt-1 text-xs sm:text-sm text-amber-800">
                Data lagres kun lokalt i denne sesjonen. Logg inn med ekte konto for synk mot medlemssiden.
              </div>
            </Card>
          ) : null}
          <div className={trainerTab === "dashboard" ? "pb-24 xl:pb-0" : undefined}>
          {trainerTab === "inspiration" ? (
            <InspirationHub
              canManage
              authorName={appState.currentUser?.name ?? "Motus"}
              exerciseBank={appState.exercises}
              programTemplates={appState.programs
                .filter((program) => program.memberId === "__template__")
                .map((program) => ({ id: program.id, title: program.title }))}
            />
          ) : trainerTab === "badges" ? (
            <TrainerBadgeCatalog />
          ) : (
            <TrainerPortal {...trainerPortalProps} />
          )}
          </div>
        </div>
      </div>

      <div className="motus-mobile-tab-bar fixed inset-x-0 bottom-0 z-[9999] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 xl:hidden">
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
        <div className="relative z-[10001] mx-auto flex max-w-lg items-stretch gap-0.5">
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

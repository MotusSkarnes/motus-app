import type { ComponentProps } from "react";
import { Bell, ClipboardList, LayoutDashboard, MessageSquare, TrendingUp, UserCircle2, type LucideIcon } from "lucide-react";
import { MOTUS } from "../app/data";
import type { AppState, MemberTab } from "../app/types";
import { Card } from "../app/ui";
import { MemberPortal } from "./MemberPortal";

type MemberAlert = {
  id: string;
  text: string;
  timestamp: number;
  targetTab: "messages" | "programs";
};

type MemberLayoutProps = {
  appState: AppState;
  memberTab: MemberTab;
  setMemberTab: (tab: MemberTab) => void;
  updateMember: ComponentProps<typeof MemberPortal>["updateMember"];
  currentMemberAvatarUrl: string;
  setCurrentMemberAvatarUrl: (url: string) => void;
  sendMemberMessage: ComponentProps<typeof MemberPortal>["sendMemberMessage"];
  startWorkoutMode: ComponentProps<typeof MemberPortal>["startWorkoutMode"];
  updateWorkoutExerciseResult: ComponentProps<typeof MemberPortal>["updateWorkoutExerciseResult"];
  replaceWorkoutExerciseGroup: ComponentProps<typeof MemberPortal>["replaceWorkoutExerciseGroup"];
  updateWorkoutModeNote: ComponentProps<typeof MemberPortal>["updateWorkoutModeNote"];
  finishWorkoutMode: ComponentProps<typeof MemberPortal>["finishWorkoutMode"];
  logGroupWorkout: ComponentProps<typeof MemberPortal>["logGroupWorkout"];
  cancelWorkoutMode: ComponentProps<typeof MemberPortal>["cancelWorkoutMode"];
  dismissWorkoutCelebration: ComponentProps<typeof MemberPortal>["dismissWorkoutCelebration"];
  memberNotificationsOpen: boolean;
  memberUnreadCount: number;
  memberVisibleAlerts: MemberAlert[];
  handleMemberBellToggle: () => void;
  openAlert: (alert: MemberAlert) => void;
};

const mobileTabs: Array<{ id: MemberTab; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Hjem", icon: LayoutDashboard },
  { id: "programs", label: "Trening", icon: ClipboardList },
  { id: "progress", label: "Fremgang", icon: TrendingUp },
  { id: "messages", label: "Meldinger", icon: MessageSquare },
  { id: "profile", label: "Profil", icon: UserCircle2 },
];

export function MemberLayout({
  appState,
  memberTab,
  setMemberTab,
  updateMember,
  currentMemberAvatarUrl,
  setCurrentMemberAvatarUrl,
  sendMemberMessage,
  startWorkoutMode,
  updateWorkoutExerciseResult,
  replaceWorkoutExerciseGroup,
  updateWorkoutModeNote,
  finishWorkoutMode,
  logGroupWorkout,
  cancelWorkoutMode,
  dismissWorkoutCelebration,
  memberNotificationsOpen,
  memberUnreadCount,
  memberVisibleAlerts,
  handleMemberBellToggle,
  openAlert,
}: MemberLayoutProps) {
  const memberPortalProps: ComponentProps<typeof MemberPortal> = {
    members: appState.members,
    currentUserRole: appState.currentUser!.role,
    currentUserEmail: appState.currentUser!.email,
    programs: appState.programs,
    logs: appState.logs,
    messages: appState.messages,
    memberViewId: appState.memberViewId,
    memberTab,
    setMemberTab,
    updateMember,
    memberAvatarUrl: currentMemberAvatarUrl,
    setMemberAvatarUrl: setCurrentMemberAvatarUrl,
    exercises: appState.exercises,
    sendMemberMessage,
    workoutMode: appState.workoutMode,
    startWorkoutMode,
    updateWorkoutExerciseResult,
    replaceWorkoutExerciseGroup,
    updateWorkoutModeNote,
    finishWorkoutMode,
    logGroupWorkout,
    cancelWorkoutMode,
    workoutCelebration: appState.workoutCelebration,
    dismissWorkoutCelebration,
  };
  return (
    <>
      <div className="space-y-3">
        <Card className="p-2.5 sm:p-3 bg-gradient-to-b from-emerald-50/80 to-pink-50/60">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs sm:text-sm font-semibold text-slate-800">Varsler</div>
            <button
              type="button"
              onClick={handleMemberBellToggle}
              className="relative rounded-lg border bg-white p-1.5 sm:p-2 text-slate-700 hover:bg-emerald-50"
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
            <div className="mt-2 max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {memberVisibleAlerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => openAlert(alert)}
                  className="w-full rounded-lg border bg-white px-2.5 py-1.5 text-left text-xs sm:text-sm text-slate-700 hover:bg-emerald-50"
                  style={{ borderColor: "rgba(20,184,166,0.25)" }}
                >
                  {alert.text}
                </button>
              ))}
              {memberVisibleAlerts.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-white px-2.5 py-1.5 text-xs sm:text-sm text-slate-500">
                  Ingen nye varsler akkurat nå.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-1.5 text-xs sm:text-sm text-slate-500">Trykk på bjellen for å se varsler.</div>
          )}
        </Card>
        <MemberPortal {...memberPortalProps} />
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-[9999] border-t bg-white/95 px-2 pt-2 backdrop-blur md:hidden"
        style={{ borderColor: "rgba(15,23,42,0.08)", paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
      >
        <div
          className="mx-auto flex max-w-md items-center gap-1.5 rounded-[22px] border bg-slate-50/90 p-1.5 shadow-lg"
          style={{ borderColor: "rgba(15,23,42,0.06)" }}
        >
          <div
            className="flex w-full items-center gap-1.5 rounded-[18px] p-1.5"
            style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
          >
            {mobileTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = memberTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMemberTab(tab.id)}
                  className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition ${
                    isActive ? "bg-white text-slate-900 shadow-sm" : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                >
                  <Icon className="h-4 w-4" />
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

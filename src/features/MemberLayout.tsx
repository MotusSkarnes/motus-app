import { useEffect, useMemo } from "react";
import type { ComponentProps } from "react";
import { Bell, CheckCircle2, ChevronRight, ClipboardList, LayoutDashboard, MessageSquare, TrendingUp, type LucideIcon } from "lucide-react";
import { MOTUS } from "../app/data";
import type { AppState, MemberTab } from "../app/types";
import { Card } from "../app/ui";
import { MemberPortal } from "./MemberPortal";

type MemberAlert = {
  id: string;
  kind: "message" | "program";
  title: string;
  text: string;
  detail: string;
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
  startCustomWorkout: ComponentProps<typeof MemberPortal>["startCustomWorkout"];
  updateWorkoutExerciseResult: ComponentProps<typeof MemberPortal>["updateWorkoutExerciseResult"];
  replaceWorkoutExerciseGroup: ComponentProps<typeof MemberPortal>["replaceWorkoutExerciseGroup"];
  removeWorkoutLogResult: ComponentProps<typeof MemberPortal>["removeWorkoutLogResult"];
  setWorkoutLogResults: ComponentProps<typeof MemberPortal>["setWorkoutLogResults"];
  updateWorkoutModeNote: ComponentProps<typeof MemberPortal>["updateWorkoutModeNote"];
  finishWorkoutMode: ComponentProps<typeof MemberPortal>["finishWorkoutMode"];
  logGroupWorkout: ComponentProps<typeof MemberPortal>["logGroupWorkout"];
  removeGroupWorkoutLog: ComponentProps<typeof MemberPortal>["removeGroupWorkoutLog"];
  cancelWorkoutMode: ComponentProps<typeof MemberPortal>["cancelWorkoutMode"];
  dismissWorkoutCelebration: ComponentProps<typeof MemberPortal>["dismissWorkoutCelebration"];
  memberNotificationsOpen: boolean;
  memberUnreadCount: number;
  memberVisibleAlerts: MemberAlert[];
  handleMemberBellToggle: () => void;
  openAlert: (alert: MemberAlert) => void;
  remoteMemberPeriodPlanRows: ComponentProps<typeof MemberPortal>["remoteMemberPeriodPlanRows"];
};

const mobileTabs: Array<{ id: MemberTab; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Hjem", icon: LayoutDashboard },
  { id: "programs", label: "Trening", icon: ClipboardList },
  { id: "progress", label: "Fremgang", icon: TrendingUp },
  { id: "messages", label: "Meldinger", icon: MessageSquare },
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
  startCustomWorkout,
  updateWorkoutExerciseResult,
  replaceWorkoutExerciseGroup,
  removeWorkoutLogResult,
  setWorkoutLogResults,
  updateWorkoutModeNote,
  finishWorkoutMode,
  logGroupWorkout,
  removeGroupWorkoutLog,
  cancelWorkoutMode,
  dismissWorkoutCelebration,
  memberNotificationsOpen,
  memberUnreadCount,
  memberVisibleAlerts,
  handleMemberBellToggle,
  openAlert,
  remoteMemberPeriodPlanRows,
}: MemberLayoutProps) {
  const isMemberLimited = useMemo(() => {
    const currentUser = appState.currentUser;
    if (!currentUser) return false;
    const normalizedEmail = currentUser.email.trim().toLowerCase();
    const candidates = appState.members.filter((member) => {
      if (currentUser.memberId && member.id === currentUser.memberId) return true;
      if (appState.memberViewId && member.id === appState.memberViewId) return true;
      return Boolean(normalizedEmail && member.email.trim().toLowerCase() === normalizedEmail);
    });
    if (currentUser.role === "member") {
      return !candidates.some((member) => member.customerType === "PT-kunde" || member.membershipType === "Premium");
    }
    return candidates.some((member) => member.customerType === "Medlem" && member.membershipType !== "Premium");
  }, [appState.currentUser, appState.members, appState.memberViewId]);
  const visibleMobileTabs = isMemberLimited
    ? mobileTabs.filter((tab) => tab.id === "overview" || tab.id === "programs")
    : mobileTabs;

  useEffect(() => {
    if (!isMemberLimited) return;
    if (memberTab === "messages" || memberTab === "progress") {
      setMemberTab("overview");
    }
  }, [isMemberLimited, memberTab, setMemberTab]);

  const memberPortalProps: ComponentProps<typeof MemberPortal> = {
    members: appState.members,
    currentUserRole: appState.currentUser!.role,
    currentUserEmail: appState.currentUser!.email,
    currentUserSupabaseId: appState.currentUser?.id,
    currentUserMemberId: appState.currentUser?.memberId,
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
    startCustomWorkout,
    updateWorkoutExerciseResult,
    replaceWorkoutExerciseGroup,
    removeWorkoutLogResult,
    setWorkoutLogResults,
    updateWorkoutModeNote,
    finishWorkoutMode,
    logGroupWorkout,
    removeGroupWorkoutLog,
    cancelWorkoutMode,
    workoutCelebration: appState.workoutCelebration,
    dismissWorkoutCelebration,
    remoteMemberPeriodPlanRows,
  };
  return (
    <>
      <div className="space-y-4 sm:space-y-5">
        {!isMemberLimited ? (
        <Card className="bg-gradient-to-br from-emerald-50/90 via-white to-pink-50/70 p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aktuelt nå</div>
              <div className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                {memberUnreadCount > 0 ? (
                  <>
                    <span>{memberUnreadCount} nytt</span>
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
              onClick={handleMemberBellToggle}
              className="relative inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-emerald-50"
              style={{ borderColor: "rgba(20,184,166,0.25)" }}
              aria-label={memberNotificationsOpen ? "Lukk varsler" : "Åpne varsler"}
            >
              <Bell className="h-4 w-4" />
              <span>{memberNotificationsOpen ? "Lukk" : "Se"}</span>
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
            <div className="mt-3 max-h-52 overflow-y-auto space-y-2 pr-1">
              {memberVisibleAlerts.map((alert) => {
                const AlertIcon = alert.kind === "message" ? MessageSquare : ClipboardList;
                return (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => openAlert(alert)}
                    className="group flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50"
                    style={{ borderColor: "rgba(20,184,166,0.25)" }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <AlertIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{alert.title}</span>
                      <span className="block truncate text-xs text-slate-500">{alert.detail}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-emerald-500" />
                  </button>
                );
              })}
              {memberVisibleAlerts.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-white px-3 py-2.5 text-sm text-slate-500">
                  Ingen nye ting å følge opp akkurat nå.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 text-xs sm:text-sm text-slate-500">
              {memberUnreadCount > 0 ? "Åpne for å gå rett til melding eller program." : "Nye meldinger og programmer dukker opp her."}
            </div>
          )}
        </Card>
        ) : null}
        <MemberPortal {...memberPortalProps} />
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-[9999] border-t bg-white/95 px-2 pt-2 backdrop-blur lg:hidden"
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
            {visibleMobileTabs.map((tab) => {
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

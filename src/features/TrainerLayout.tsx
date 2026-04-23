import type { ComponentProps, Dispatch, SetStateAction } from "react";
import { BarChart3, Bell, CalendarDays, CheckSquare, ClipboardList, Dumbbell, LayoutDashboard, MessageSquare, Settings, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { MOTUS } from "../app/data";
import type { AppState, TrainerTab } from "../app/types";
import { Card } from "../app/ui";
import { TrainerPortal } from "./TrainerPortal";

type TrainerAlert = {
  id: string;
  memberId: string;
  text: string;
  timestamp: number;
};

const trainerMenuItems: Array<{ key: TrainerTab; label: string; icon: LucideIcon }> = [
  { key: "dashboard", label: "Oversikt", icon: LayoutDashboard },
  { key: "customers", label: "Klienter", icon: Users },
  { key: "exerciseBank", label: "Øvelsesbank", icon: Dumbbell },
  { key: "programs", label: "Programmer", icon: ClipboardList },
  { key: "calendar", label: "Kalender", icon: CalendarDays },
  { key: "messages", label: "Meldinger", icon: MessageSquare },
  { key: "tasks", label: "Oppgaver", icon: CheckSquare },
  { key: "statistics", label: "Statistikk", icon: BarChart3 },
  { key: "settings", label: "Innstillinger", icon: Settings },
  { key: "admin", label: "Admin", icon: ShieldCheck },
];

const mobileTabs: Array<{ id: TrainerTab; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Oversikt", icon: LayoutDashboard },
  { id: "customers", label: "Klienter", icon: Users },
  { id: "programs", label: "Program", icon: ClipboardList },
  { id: "exerciseBank", label: "Øvelser", icon: Dumbbell },
  { id: "messages", label: "Meldinger", icon: MessageSquare },
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
  saveExercise,
  openCustomerMessagesSignal,
  setOpenCustomerMessagesSignal,
  memberAvatarById,
  setMemberAvatarUrlForMember,
  trainerNotificationsOpen,
  setTrainerNotificationsOpen,
  trainerUnreadCount,
  trainerMessageAlerts,
  handleTrainerBellToggle,
}: {
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
  saveExercise: ComponentProps<typeof TrainerPortal>["saveExercise"];
  openCustomerMessagesSignal: number;
  setOpenCustomerMessagesSignal: Dispatch<SetStateAction<number>>;
  memberAvatarById: Record<string, string>;
  setMemberAvatarUrlForMember: ComponentProps<typeof TrainerPortal>["setMemberAvatarUrlForMember"];
  trainerNotificationsOpen: boolean;
  setTrainerNotificationsOpen: (open: boolean) => void;
  trainerUnreadCount: number;
  trainerMessageAlerts: TrainerAlert[];
  handleTrainerBellToggle: () => void;
}) {
  const inactiveMembersCount = appState.members.filter((member) => Number(member.daysSinceActivity || "0") >= 7).length;
  const missingInvitesCount = appState.members.filter((member) => !member.invitedAt).length;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <Card className="hidden h-fit p-3 md:block">
          <div className="mb-2 px-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">PT-meny</div>
          </div>
          <div className="space-y-1.5">
            {trainerMenuItems.map((item) => {
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
          </div>
        </Card>
        <div className="space-y-3">
          <Card className="p-2.5 sm:p-3 bg-gradient-to-b from-emerald-50/80 to-pink-50/60">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs sm:text-sm font-semibold text-slate-800">Varsler</div>
              <button
                type="button"
                onClick={handleTrainerBellToggle}
                className="relative rounded-lg border bg-white p-1.5 sm:p-2 text-slate-700 hover:bg-emerald-50"
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
              <div className="mt-2 max-h-36 overflow-y-auto space-y-1.5 pr-1">
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
                    className="w-full rounded-lg border bg-white px-2.5 py-1.5 text-left text-xs sm:text-sm text-slate-700 hover:bg-emerald-50"
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
                    className="w-full rounded-lg border bg-white px-2.5 py-1.5 text-left text-xs sm:text-sm text-slate-700 hover:bg-emerald-50"
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
                    className="w-full rounded-lg border bg-white px-2.5 py-1.5 text-left text-xs sm:text-sm text-slate-700 hover:bg-emerald-50"
                    style={{ borderColor: "rgba(20,184,166,0.25)" }}
                  >
                    {inactiveMembersCount} kunder bør følges opp
                  </button>
                ) : null}
                {!trainerMessageAlerts.length && !missingInvitesCount && !inactiveMembersCount ? (
                  <div className="rounded-lg border border-dashed bg-white px-2.5 py-1.5 text-xs sm:text-sm text-slate-500">
                    Ingen nye varsler akkurat nå.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-1.5 text-xs sm:text-sm text-slate-500">Trykk på bjellen for å se varsler.</div>
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
            setMemberAvatarUrlForMember={setMemberAvatarUrlForMember}
          />
        </div>
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
              const isActive = trainerTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTrainerTab(tab.id)}
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

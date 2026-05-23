import { useMemo } from "react";
import { UserCircle2 } from "lucide-react";
import { MOTUS } from "../app/data";
import type { AuthUser, MemberTab, Role } from "../app/types";
import { Card, OutlineButton, PillButton } from "../app/ui";
import type { MemberAlert } from "../app/useNotifications";
import motusLogo from "../assets/motus-logo-transparent.svg";
import { MemberHomeHeaderActions } from "./MemberHomeHeaderActions";
import { MemberNotificationsPanel } from "./MemberNotificationsPanel";

export function AppHeader({
  currentUser,
  memberDisplayName: _memberDisplayName,
  memberTrainerDisplayName: _memberTrainerDisplayName,
  role,
  memberTab = "overview",
  showQuickLogin,
  onSwitchRole,
  onResetData,
  onLogout,
  onOpenMemberProfile,
  memberUnreadCount = 0,
  memberNotificationsOpen = false,
  memberVisibleAlerts = [],
  onMemberBellToggle,
  onOpenMemberAlert,
  showMemberNotifications = false,
}: {
  currentUser: AuthUser;
  memberDisplayName?: string;
  memberTrainerDisplayName?: string;
  role: Role;
  memberTab?: MemberTab;
  showQuickLogin: boolean;
  onSwitchRole: (role: Role) => void;
  onResetData: () => void;
  onLogout: () => void;
  onOpenMemberProfile?: () => void;
  memberUnreadCount?: number;
  memberNotificationsOpen?: boolean;
  memberVisibleAlerts?: MemberAlert[];
  onMemberBellToggle?: () => void;
  onOpenMemberAlert?: (alert: MemberAlert) => void;
  showMemberNotifications?: boolean;
}) {
  const showProductionSafeQuickTools = showQuickLogin && (import.meta.env.DEV || import.meta.env.MODE === "test");
  const isTrainerPortalView = role === "trainer";
  const trainerDisplayName = useMemo(() => {
    const name = currentUser.name.trim();
    const email = currentUser.email.trim().toLowerCase();
    if (name && name !== "Bruker" && !name.includes("@")) return name;
    const localPart = (email.split("@")[0] ?? "").replace(/[._-]+/g, " ").trim();
    if (!localPart) return "Trener";
    return localPart
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }, [currentUser.email, currentUser.name]);

  if (currentUser.role === "member") {
    if (memberTab === "overview") return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-end">
          <MemberHomeHeaderActions
            showNotifications={showMemberNotifications}
            memberUnreadCount={memberUnreadCount}
            memberNotificationsOpen={memberNotificationsOpen}
            onMemberBellToggle={onMemberBellToggle}
            onOpenMemberProfile={onOpenMemberProfile}
            onLogout={onLogout}
          />
        </div>
        {showMemberNotifications && memberNotificationsOpen && onOpenMemberAlert ? (
          <MemberNotificationsPanel alerts={memberVisibleAlerts} onOpenAlert={onOpenMemberAlert} />
        ) : null}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(20,184,166,0.07)_0%,rgba(236,72,153,0.07)_100%)] p-4 sm:p-5 md:p-6">
      <div
        className="-mx-4 -mt-4 mb-5 h-1.5 sm:-mx-5 sm:-mt-5 md:-mx-6 md:-mt-6"
        style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 70%, ${MOTUS.acid} 100%)` }}
      />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <img src={motusLogo} alt="Motus logo" className="h-10 w-auto object-contain sm:h-11" />
          </div>
          <div>
            {isTrainerPortalView ? (
              <>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">Motus Coach</h1>
                <div
                  className="mt-3 inline-flex min-w-0 max-w-full items-center gap-3 rounded-2xl border border-emerald-200/90 bg-white/95 px-4 py-3 shadow-sm ring-1 ring-black/5"
                  style={{ borderLeftWidth: 4, borderLeftColor: MOTUS.turquoise }}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                    aria-hidden
                  >
                    <UserCircle2 className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Innlogget som PT
                    </span>
                    <span className="block truncate text-base font-bold text-slate-900 sm:text-lg">{trainerDisplayName}</span>
                    <span className="block truncate text-xs text-slate-500 sm:text-sm">{currentUser.email}</span>
                  </span>
                </div>
                <p className="mt-3 max-w-3xl text-sm text-slate-500 md:text-base">
                  Du ser dine kunder, programmer og oppfølging. Medlemmer og andre PT-er ser kun sin egen konto.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">Motus Coach</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-500 md:text-base">
                  Administrer medlemmer, programmer og oppfølging på ett sted.
                </p>
              </>
            )}
          </div>
        </div>
        {showProductionSafeQuickTools ? (
          <Card className="w-full self-stretch p-1 md:w-auto md:self-auto">
            <div className="grid w-full grid-cols-2 gap-1 rounded-xl bg-slate-50 p-1 md:w-[280px]">
              <PillButton active={role === "trainer"} onClick={() => onSwitchRole("trainer")}>
                PT-side
              </PillButton>
              <PillButton active={role === "member"} onClick={() => onSwitchRole("member")}>
                Medlemsside
              </PillButton>
            </div>
          </Card>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          {showProductionSafeQuickTools ? <OutlineButton onClick={onResetData}>Nullstill testdata</OutlineButton> : null}
          <OutlineButton onClick={onLogout}>Logg ut</OutlineButton>
        </div>
      </div>
    </Card>
  );
}

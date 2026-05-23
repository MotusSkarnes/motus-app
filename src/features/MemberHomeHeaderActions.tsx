import { Bell, LogOut, UserCircle2 } from "lucide-react";
import { MOTUS } from "../app/data";

type MemberHomeHeaderActionsProps = {
  showNotifications?: boolean;
  memberUnreadCount?: number;
  memberNotificationsOpen?: boolean;
  onMemberBellToggle?: () => void;
  onOpenMemberProfile?: () => void;
  onLogout: () => void;
};

export function MemberHomeHeaderActions({
  showNotifications = false,
  memberUnreadCount = 0,
  memberNotificationsOpen = false,
  onMemberBellToggle,
  onOpenMemberProfile,
  onLogout,
}: MemberHomeHeaderActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {showNotifications ? (
        <button
          type="button"
          onClick={onMemberBellToggle}
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label={memberNotificationsOpen ? "Lukk varsler" : "Åpne varsler"}
          title={memberNotificationsOpen ? "Lukk varsler" : "Varsler"}
        >
          <Bell className="h-4 w-4" aria-hidden />
          {memberUnreadCount > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] font-bold text-white"
              style={{ backgroundColor: MOTUS.pink }}
            >
              {memberUnreadCount > 9 ? "9+" : memberUnreadCount}
            </span>
          ) : null}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onOpenMemberProfile?.()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm transition hover:opacity-90"
        style={{ backgroundColor: MOTUS.turquoise }}
        aria-label="Åpne profil"
        title="Profil"
      >
        <UserCircle2 className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onLogout}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm transition hover:opacity-90"
        style={{ backgroundColor: MOTUS.pink }}
        aria-label="Logg ut"
        title="Logg ut"
      >
        <LogOut className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

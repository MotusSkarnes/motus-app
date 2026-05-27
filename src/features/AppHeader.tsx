import { Card, OutlineButton, PillButton } from "../app/ui";
import type { AuthUser, MemberTab, Role } from "../app/types";
import type { MemberAlert, TrainerAlert } from "../app/useNotifications";
import { MemberHomeHeaderActions } from "./MemberHomeHeaderActions";
import { MemberNotificationsPanel } from "./MemberNotificationsPanel";
import { MotusTopBanner } from "./MotusTopBanner";
import { TrainerNotificationsPanel } from "./TrainerNotificationsPanel";

export function AppHeader({
  currentUser: _currentUser,
  memberDisplayName: _memberDisplayName,
  memberTrainerDisplayName: _memberTrainerDisplayName,
  role,
  memberTab: _memberTab = "overview",
  showQuickLogin,
  onSwitchRole,
  onResetData,
  onLogout,
  memberUnreadCount = 0,
  memberUnreadMessageCount = 0,
  memberNotificationsOpen = false,
  memberVisibleAlerts = [],
  onMemberBellToggle,
  onMemberMessagesClick,
  onOpenMemberAlert,
  onMarkAllMemberAlertsAsRead,
  showMemberNotifications = false,
  showMemberMessages = false,
  trainerUnreadCount = 0,
  trainerNotificationsOpen = false,
  trainerVisibleAlerts = [],
  onTrainerBellToggle,
  onOpenTrainerAlert,
  onMarkAllTrainerAlertsAsRead,
  showTrainerNotifications = false,
  showTrainerMemberPreviewBar = false,
  onExitTrainerMemberPreview,
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
  memberUnreadCount?: number;
  memberUnreadMessageCount?: number;
  memberNotificationsOpen?: boolean;
  memberVisibleAlerts?: MemberAlert[];
  onMemberBellToggle?: () => void;
  onMemberMessagesClick?: () => void;
  onOpenMemberAlert?: (alert: MemberAlert) => void;
  onMarkAllMemberAlertsAsRead?: () => void;
  showMemberNotifications?: boolean;
  showMemberMessages?: boolean;
  trainerUnreadCount?: number;
  trainerNotificationsOpen?: boolean;
  trainerVisibleAlerts?: TrainerAlert[];
  onTrainerBellToggle?: () => void;
  onOpenTrainerAlert?: (alert: TrainerAlert) => void;
  onMarkAllTrainerAlertsAsRead?: () => void;
  showTrainerNotifications?: boolean;
  showTrainerMemberPreviewBar?: boolean;
  onExitTrainerMemberPreview?: () => void;
}) {
  const showProductionSafeQuickTools = showQuickLogin && (import.meta.env.DEV || import.meta.env.MODE === "test");
  const isTrainer = role === "trainer";

  const actions = (
    <MemberHomeHeaderActions
      showNotifications={isTrainer ? showTrainerNotifications : showMemberNotifications}
      showMessages={!isTrainer && showMemberMessages}
      memberUnreadCount={isTrainer ? trainerUnreadCount : memberUnreadCount}
      memberUnreadMessageCount={memberUnreadMessageCount}
      memberNotificationsOpen={isTrainer ? trainerNotificationsOpen : memberNotificationsOpen}
      onMemberBellToggle={isTrainer ? onTrainerBellToggle : onMemberBellToggle}
      onMemberMessagesClick={onMemberMessagesClick}
      onLogout={onLogout}
    />
  );

  const notificationsPanel =
    isTrainer && showTrainerNotifications && trainerNotificationsOpen && onOpenTrainerAlert ? (
      <TrainerNotificationsPanel
        alerts={trainerVisibleAlerts}
        unreadCount={trainerUnreadCount}
        onOpenAlert={onOpenTrainerAlert}
        onMarkAllAsRead={onMarkAllTrainerAlertsAsRead}
      />
    ) : !isTrainer && showMemberNotifications && memberNotificationsOpen && onOpenMemberAlert ? (
      <MemberNotificationsPanel
        alerts={memberVisibleAlerts}
        unreadCount={memberUnreadCount}
        onOpenAlert={onOpenMemberAlert}
        onMarkAllAsRead={onMarkAllMemberAlertsAsRead}
      />
    ) : null;

  const devFooter = showProductionSafeQuickTools ? (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Card className="w-full p-1 sm:max-w-[280px]">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-50 p-1">
          <PillButton active={role === "trainer"} onClick={() => onSwitchRole("trainer")}>
            PT-side
          </PillButton>
          <PillButton active={role === "member"} onClick={() => onSwitchRole("member")}>
            Medlemsside
          </PillButton>
        </div>
      </Card>
      <div className="flex flex-wrap gap-2">
        <OutlineButton onClick={onResetData}>Nullstill testdata</OutlineButton>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-2">
      {showTrainerMemberPreviewBar && onExitTrainerMemberPreview ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#30E3BE]/35 bg-[#30E3BE]/10 px-4 py-2.5 text-sm">
          <span className="font-medium text-slate-800">Du ser appen slik kunden ser den</span>
          <button
            type="button"
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-black/5 transition hover:bg-slate-50"
            onClick={onExitTrainerMemberPreview}
          >
            Til PT-visning
          </button>
        </div>
      ) : null}
      <MotusTopBanner actions={actions} notificationsPanel={notificationsPanel} footer={devFooter} />
    </div>
  );
}

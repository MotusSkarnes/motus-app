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
  memberNotificationsOpen = false,
  memberVisibleAlerts = [],
  onMemberBellToggle,
  onOpenMemberAlert,
  showMemberNotifications = false,
  trainerUnreadCount = 0,
  trainerNotificationsOpen = false,
  trainerVisibleAlerts = [],
  onTrainerBellToggle,
  onOpenTrainerAlert,
  showTrainerNotifications = false,
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
  memberNotificationsOpen?: boolean;
  memberVisibleAlerts?: MemberAlert[];
  onMemberBellToggle?: () => void;
  onOpenMemberAlert?: (alert: MemberAlert) => void;
  showMemberNotifications?: boolean;
  trainerUnreadCount?: number;
  trainerNotificationsOpen?: boolean;
  trainerVisibleAlerts?: TrainerAlert[];
  onTrainerBellToggle?: () => void;
  onOpenTrainerAlert?: (alert: TrainerAlert) => void;
  showTrainerNotifications?: boolean;
}) {
  const showProductionSafeQuickTools = showQuickLogin && (import.meta.env.DEV || import.meta.env.MODE === "test");
  const isTrainer = role === "trainer";

  const actions = (
    <MemberHomeHeaderActions
      showNotifications={isTrainer ? showTrainerNotifications : showMemberNotifications}
      memberUnreadCount={isTrainer ? trainerUnreadCount : memberUnreadCount}
      memberNotificationsOpen={isTrainer ? trainerNotificationsOpen : memberNotificationsOpen}
      onMemberBellToggle={isTrainer ? onTrainerBellToggle : onMemberBellToggle}
      onLogout={onLogout}
    />
  );

  const notificationsPanel =
    isTrainer && showTrainerNotifications && trainerNotificationsOpen && onOpenTrainerAlert ? (
      <TrainerNotificationsPanel alerts={trainerVisibleAlerts} onOpenAlert={onOpenTrainerAlert} />
    ) : !isTrainer && showMemberNotifications && memberNotificationsOpen && onOpenMemberAlert ? (
      <MemberNotificationsPanel alerts={memberVisibleAlerts} onOpenAlert={onOpenMemberAlert} />
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

  return <MotusTopBanner actions={actions} notificationsPanel={notificationsPanel} footer={devFooter} />;
}

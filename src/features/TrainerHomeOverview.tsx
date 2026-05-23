import type { ReactNode } from "react";
import { ClipboardList, Dumbbell, MessageSquare, Users, Zap } from "lucide-react";
import { MOTUS } from "../app/data";
import { MotusFlameIcon } from "./MotusFlameIcon";

export type TrainerHomeQuickActions = {
  onOpenCustomers: () => void;
  onOpenPrograms: () => void;
  onOpenMessages: () => void;
};

export type TrainerHomeOverviewProps = {
  trainerFirstName: string;
  todayDateLabel: string;
  dashboardHeadline: string;
  dashboardSubline?: string | null;
  opsHealthPct: number;
  followUpCount: number;
  membersWithoutProgramCount: number;
  todaysCustomers: number;
  todaysWorkouts: number;
  newMessages24h: number;
  onFollowUpClick: () => void;
  onMissingProgramClick: () => void;
  quickActions: TrainerHomeQuickActions;
  headerActions?: ReactNode;
  notificationsPanel?: ReactNode;
  children?: ReactNode;
};

export function TrainerHomeOverview({
  trainerFirstName,
  todayDateLabel,
  dashboardHeadline,
  dashboardSubline,
  opsHealthPct,
  followUpCount,
  membersWithoutProgramCount,
  todaysCustomers,
  todaysWorkouts,
  newMessages24h,
  onFollowUpClick,
  onMissingProgramClick,
  quickActions,
  headerActions,
  notificationsPanel,
  children,
}: TrainerHomeOverviewProps) {
  return (
    <div className="motus-home motus-fade-in-up">
      <header className="relative px-0.5">
        <div className="pointer-events-none absolute -left-6 -right-6 -top-8 h-36 bg-[radial-gradient(ellipse_at_top,rgba(48,227,190,0.14),transparent_68%)]" aria-hidden />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[1.5rem]">
              Hei, {trainerFirstName}! <span aria-hidden>👋</span>
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">{todayDateLabel}</p>
          </div>
          {headerActions}
        </div>
        {notificationsPanel ? <div className="relative mt-4">{notificationsPanel}</div> : null}
      </header>

      <section className="motus-home-dashboard" aria-label="Dagens oversikt">
        <div className="flex gap-4">
          <div className="motus-home-streak-ring shrink-0" aria-hidden>
            <svg viewBox="0 0 88 88" className="h-[5.5rem] w-[5.5rem]">
              <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(48,227,190,0.18)" strokeWidth="7" />
              <circle
                cx="44"
                cy="44"
                r="36"
                fill="none"
                stroke={MOTUS.turquoise}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${Math.max(12, Math.min(226, (opsHealthPct / 100) * 226))} 226`}
                transform="rotate(-90 44 44)"
              />
            </svg>
            <div className="motus-home-streak-ring-center">
              <MotusFlameIcon className="mx-auto h-4 w-4" title="" />
              <span className="mt-1 block text-lg font-bold tabular-nums leading-none text-slate-900">{followUpCount}</span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide text-slate-500">oppfølging</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="text-base font-semibold leading-snug text-slate-900">{dashboardHeadline}</h2>
            {dashboardSubline ? <p className="mt-1 text-sm leading-relaxed text-slate-600">{dashboardSubline}</p> : null}
            <ul className="mt-3 space-y-2">
              <li className="flex items-center gap-2.5 text-sm text-slate-700">
                <span className="motus-home-dash-icon">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span>
                  {followUpCount > 0 ? (
                    <button
                      type="button"
                      onClick={onFollowUpClick}
                      className="font-medium text-rose-700 underline decoration-rose-300 underline-offset-2 hover:text-rose-800"
                    >
                      {followUpCount} kunder trenger oppfølging
                    </button>
                  ) : (
                    <span className="font-medium">Ingen kunder trenger oppfølging nå</span>
                  )}
                </span>
              </li>
              <li className="flex items-center gap-2.5 text-sm text-slate-700">
                <span className="motus-home-dash-icon">
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span>
                  {membersWithoutProgramCount > 0 ? (
                    <button
                      type="button"
                      onClick={onMissingProgramClick}
                      className="font-medium text-amber-800 underline decoration-amber-300 underline-offset-2 hover:text-amber-900"
                    >
                      {membersWithoutProgramCount} mangler program
                    </button>
                  ) : (
                    <span className="font-medium">Alle aktive kunder har program</span>
                  )}
                </span>
              </li>
              <li className="flex items-center gap-2.5 text-sm text-slate-700">
                <span className="motus-home-dash-icon">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span>
                  <span className="font-medium">Meldinger 24t</span>
                  <span className="text-slate-500"> · {newMessages24h}</span>
                </span>
              </li>
            </ul>
            <div className="motus-progress-track mt-3 h-1.5 rounded-full">
              <div
                className="motus-progress-fill h-1.5 rounded-full"
                style={{
                  width: `${opsHealthPct}%`,
                  background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="flex gap-3 overflow-x-auto pb-0.5 scrollbar-none" aria-label="Dagens tall">
        <TrainerStatPill value={String(todaysCustomers)} label="kunder i dag" icon={Users} />
        <TrainerStatPill value={String(todaysWorkouts)} label="økter i dag" icon={Dumbbell} />
        <TrainerStatPill value={String(newMessages24h)} label="meldinger 24t" icon={Zap} />
      </section>

      <section className="grid grid-cols-3 gap-2.5" aria-label="Hurtighandlinger">
        <TrainerQuickAction label="Klienter" icon={Users} tone="brand" onClick={quickActions.onOpenCustomers} />
        <TrainerQuickAction label="Meldinger" icon={MessageSquare} tone="pink" onClick={quickActions.onOpenMessages} />
        <TrainerQuickAction label="Programmer" icon={ClipboardList} tone="pink" onClick={quickActions.onOpenPrograms} />
      </section>

      {children ? <div className="space-y-4">{children}</div> : null}
    </div>
  );
}

function TrainerStatPill({
  value,
  label,
  icon: Icon,
}: {
  value: string;
  label: string;
  icon: typeof Users;
}) {
  return (
    <div className="motus-stat-pill shrink-0">
      <span className="motus-stat-pill-icon" aria-hidden>
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <span className="min-w-0">
        <span className="block text-[17px] font-semibold tabular-nums leading-none tracking-tight text-slate-800">{value}</span>
        <span className="mt-1 block text-[11px] font-medium leading-none text-slate-500">{label}</span>
      </span>
    </div>
  );
}

function TrainerQuickAction({
  label,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  icon: typeof Users;
  tone: "brand" | "pink";
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="motus-home-quick-action motus-pressable text-left">
      <span
        className={`motus-home-quick-action-icon ${tone === "brand" ? "motus-home-quick-action-icon--brand" : "motus-home-quick-action-icon--pink"}`}
        aria-hidden
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="mt-2 block text-[11px] font-semibold leading-snug text-slate-800">{label}</span>
    </button>
  );
}

export function TrainerHomeSection({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="motus-home-week-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

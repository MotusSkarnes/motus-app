import type { ReactNode } from "react";
import {
  BarChart3,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  Dumbbell,
  MessageSquare,
  Plus,
  Users,
} from "lucide-react";
import { MOTUS } from "../app/data";
import type { TrainerFocusItem, TrainerTodayFeedItem } from "../app/trainerDashboardFeed";
import { coachingStatusLabel } from "../app/trainerDashboardFeed";
import { MotusFlameIcon } from "./MotusFlameIcon";

export type TrainerHomeQuickActions = {
  onOpenCustomers: () => void;
  onOpenPrograms: () => void;
  onOpenMessages: () => void;
};

export type TrainerFollowUpCardModel = {
  memberId: string;
  memberName: string;
  memberEmail: string;
  avatarUrl: string | null;
  customerTypeLabel: string;
  primaryReason: string;
  secondaryReason?: string;
  score: number;
  lastFollowUpLabel: string;
  priorityTone: "red" | "orange" | "green";
};

export type TrainerTodoModel = {
  id: string;
  title: string;
  done: boolean;
  priority?: "high" | "medium" | "low";
};

export type TrainerPriorityMemberModel = {
  memberId: string;
  memberName: string;
  avatarUrl: string | null;
  customerTypeLabel: string;
  activityLabel: string;
  statusTone: "red" | "orange" | "green";
};

export type TrainerHomeOverviewProps = {
  trainerFirstName: string;
  todayDateLabel: string;
  focusItems: TrainerFocusItem[];
  activeMemberCount: number;
  todaysCustomers: number;
  todaysWorkouts: number;
  newMessages24h: number;
  followUpCount: number;
  criticalFollowUpCount: number;
  primaryFollowUp: TrainerFollowUpCardModel | null;
  secondaryFollowUps: TrainerFollowUpCardModel[];
  todayFeed: TrainerTodayFeedItem[];
  todos: TrainerTodoModel[];
  todoDraft: string;
  onTodoDraftChange: (value: string) => void;
  onAddTodo: () => void;
  onToggleTodo: (id: string) => void;
  priorityMembers: TrainerPriorityMemberModel[];
  insightTitle: string;
  insightDetail: string;
  onFollowUpClick: () => void;
  onMissingProgramClick: () => void;
  onOpenMember: (memberId: string) => void;
  onContactMember: (memberId: string) => void;
  onMarkFollowedUp: (memberId: string) => void;
  onOpenProgressInsight?: () => void;
  quickActions: TrainerHomeQuickActions;
  headerActions?: ReactNode;
  notificationsPanel?: ReactNode;
};

function MemberAvatar({ name, avatarUrl, size = "md" }: { name: string; avatarUrl: string | null; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  return (
    <div className={`relative overflow-hidden rounded-full border border-white/80 bg-slate-100 ${sizeClass}`}>
      <Users className="absolute inset-0 m-auto h-4 w-4 text-slate-300" aria-hidden />
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="relative z-10 h-full w-full object-cover"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <span className="sr-only">{name}</span>
    </div>
  );
}

function statusToneClass(tone: "red" | "orange" | "green", pulse = false): string {
  const base =
    tone === "red"
      ? "motus-trainer-status--critical"
      : tone === "orange"
        ? "motus-trainer-status--warning"
        : "motus-trainer-status--stable";
  return pulse ? `${base} motus-trainer-status--pulse` : base;
}

export function TrainerHomeOverview({
  trainerFirstName,
  todayDateLabel,
  focusItems,
  activeMemberCount,
  todaysCustomers,
  todaysWorkouts,
  newMessages24h,
  followUpCount,
  criticalFollowUpCount,
  primaryFollowUp,
  secondaryFollowUps,
  todayFeed,
  todos,
  todoDraft,
  onTodoDraftChange,
  onAddTodo,
  onToggleTodo,
  priorityMembers,
  insightTitle,
  insightDetail,
  onFollowUpClick,
  onOpenMember,
  onContactMember,
  onMarkFollowedUp,
  onOpenProgressInsight,
  quickActions,
  headerActions,
  notificationsPanel,
}: TrainerHomeOverviewProps) {
  const openTodos = todos.filter((todo) => !todo.done);

  return (
    <div className="motus-home motus-trainer-home motus-fade-in-up">
      <header className="relative px-0.5">
        <div
          className="pointer-events-none absolute -left-6 -right-6 -top-8 h-40 bg-[radial-gradient(ellipse_at_top,rgba(48,227,190,0.16),transparent_68%)]"
          aria-hidden
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[1.45rem] font-bold leading-tight tracking-tight text-slate-950 sm:text-[1.65rem]">
              Hei, {trainerFirstName}! <span aria-hidden>👋</span>
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-600">Her er oversikten din for i dag</p>
            <p className="mt-0.5 text-xs text-slate-500">{todayDateLabel}</p>
          </div>
          {headerActions}
        </div>
        {notificationsPanel ? <div className="relative mt-4">{notificationsPanel}</div> : null}
      </header>

      <section className="motus-trainer-focus-card" aria-label="Dagens fokus">
        <p className="motus-trainer-section-eyebrow">Dagens fokus</p>
        <ul className="mt-3 space-y-2">
          {focusItems.map((item) => (
            <li
              key={item.id}
              className={`motus-trainer-focus-item motus-trainer-focus-item--${item.tone}`}
            >
              <span className="motus-trainer-focus-dot" aria-hidden />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="motus-trainer-stats-row scrollbar-none" aria-label="Dagens tall">
        <TrainerStatCard value={String(activeMemberCount)} label="kunder" delta="aktive nå" tone="mint" />
        <TrainerStatCard value={String(todaysWorkouts)} label="økter i dag" delta={`${todaysCustomers} kunder`} tone="mint" />
        <TrainerStatCard value={String(newMessages24h)} label="meldinger 24t" delta="siste døgn" tone="pink" />
        <TrainerStatCard
          value={String(followUpCount)}
          label="oppfølging"
          delta={followUpCount > 0 ? "trenger deg" : "ingen nå"}
          tone={followUpCount > 0 ? "pink" : "mint"}
          onClick={followUpCount > 0 ? onFollowUpClick : undefined}
        />
      </section>

      <section className="motus-trainer-priority-hero-wrap" aria-label="Bør kontaktes nå">
        <div className="motus-trainer-section-head">
          <div>
            <h2 className="motus-trainer-section-title">Bør kontaktes nå</h2>
            {criticalFollowUpCount > 0 ? (
              <span className="motus-trainer-critical-badge">{criticalFollowUpCount} kritisk</span>
            ) : null}
          </div>
          {followUpCount > 0 ? (
            <button type="button" onClick={onFollowUpClick} className="motus-trainer-link-btn motus-pressable">
              Se alle
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>

        {primaryFollowUp ? (
          <article className={`motus-trainer-priority-hero ${statusToneClass(primaryFollowUp.priorityTone, true)}`}>
            <div className="motus-trainer-priority-hero-main">
              <MemberAvatar name={primaryFollowUp.memberName} avatarUrl={primaryFollowUp.avatarUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-950">{primaryFollowUp.memberName}</h3>
                  <span className="motus-trainer-type-badge">{primaryFollowUp.customerTypeLabel}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-800">{primaryFollowUp.primaryReason}</p>
                {primaryFollowUp.secondaryReason ? (
                  <p className="mt-0.5 text-xs text-slate-600">{primaryFollowUp.secondaryReason}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-slate-500">Sist fulgt opp: {primaryFollowUp.lastFollowUpLabel}</p>
              </div>
              <span className="motus-trainer-score-pill">Prioritet {primaryFollowUp.score}</span>
            </div>
            <div className="motus-trainer-priority-hero-actions">
              <button
                type="button"
                onClick={() => onContactMember(primaryFollowUp.memberId)}
                className="motus-trainer-cta-primary motus-pressable"
              >
                Kontakt nå
              </button>
              <button
                type="button"
                onClick={() => onOpenMember(primaryFollowUp.memberId)}
                className="motus-trainer-cta-secondary motus-pressable"
              >
                Åpne kunde
              </button>
              <button
                type="button"
                onClick={() => onMarkFollowedUp(primaryFollowUp.memberId)}
                className="motus-trainer-cta-secondary motus-pressable"
              >
                Marker fulgt opp
              </button>
            </div>
          </article>
        ) : (
          <div className="motus-trainer-empty-card">Ingen kunder trenger ekstra oppfølging akkurat nå.</div>
        )}

        {secondaryFollowUps.length > 0 ? (
          <div className="motus-trainer-priority-scroll scrollbar-none">
            {secondaryFollowUps.map((item) => (
              <button
                key={item.memberId}
                type="button"
                onClick={() => onOpenMember(item.memberId)}
                className={`motus-trainer-priority-chip motus-pressable ${statusToneClass(item.priorityTone)}`}
              >
                <MemberAvatar name={item.memberName} avatarUrl={item.avatarUrl} size="sm" />
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.memberName}</p>
                  <p className="truncate text-[11px] text-slate-600">{item.primaryReason}</p>
                  <span className={`motus-trainer-status-pill ${statusToneClass(item.priorityTone)}`}>
                    {coachingStatusLabel(item.priorityTone)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <div className="motus-trainer-dual-grid">
        <section className="motus-trainer-panel" aria-label="I dag">
          <div className="motus-trainer-section-head">
            <h2 className="motus-trainer-section-title">I dag</h2>
          </div>
          <div className="motus-trainer-feed">
            {todayFeed.length === 0 ? (
              <p className="motus-trainer-feed-empty">Ingen planlagte aktiviteter ennå — legg til oppgaver under.</p>
            ) : (
              todayFeed.map((item) => (
                <div key={item.id} className={`motus-trainer-feed-item motus-trainer-feed-item--${item.tone}`}>
                  <span className="motus-trainer-feed-time">{item.timeLabel}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    {item.subtitle ? <p className="text-xs text-slate-500">{item.subtitle}</p> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="motus-trainer-panel" aria-label="Dagens oppgaver">
          <div className="motus-trainer-section-head">
            <h2 className="motus-trainer-section-title">Dagens oppgaver</h2>
            <button
              type="button"
              onClick={onAddTodo}
              className="motus-trainer-icon-btn motus-pressable"
              aria-label="Legg til oppgave"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="motus-trainer-todo-add">
            <input
              type="text"
              value={todoDraft}
              onChange={(event) => onTodoDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onAddTodo();
              }}
              placeholder="Ny oppgave…"
              className="motus-trainer-todo-input"
            />
          </div>
          <ul className="motus-trainer-todo-list">
            {todos.length === 0 ? (
              <li className="motus-trainer-feed-empty">Ingen oppgaver for i dag.</li>
            ) : (
              todos.map((todo) => (
                <li key={todo.id}>
                  <button
                    type="button"
                    onClick={() => onToggleTodo(todo.id)}
                    className={`motus-trainer-todo-row motus-pressable ${todo.done ? "motus-trainer-todo-row--done" : ""}`}
                  >
                    <span className={`motus-trainer-todo-check ${todo.done ? "motus-trainer-todo-check--done" : ""}`}>
                      {todo.done ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className={`block text-sm ${todo.done ? "text-slate-400 line-through" : "font-medium text-slate-800"}`}>
                        {todo.title}
                      </span>
                      {!todo.done && todo.priority === "high" ? (
                        <span className="text-[10px] font-semibold text-rose-600">Høy prioritet</span>
                      ) : null}
                      {!todo.done && todo.priority === "medium" ? (
                        <span className="text-[10px] font-semibold text-amber-600">Medium prioritet</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          {openTodos.length > 0 ? (
            <p className="mt-2 text-[11px] font-medium text-slate-500">{openTodos.length} igjen i dag</p>
          ) : null}
        </section>
      </div>

      <section className="motus-trainer-panel" aria-label="Kundeprioritering">
        <div className="motus-trainer-section-head">
          <div>
            <h2 className="motus-trainer-section-title">Kundeprioritering</h2>
            <p className="mt-0.5 text-xs text-slate-500">Viktigste kunder først</p>
          </div>
          <button type="button" onClick={quickActions.onOpenCustomers} className="motus-trainer-link-btn motus-pressable">
            Se alle
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        {priorityMembers.length === 0 ? (
          <div className="motus-trainer-empty-card">Ingen kunder med kritisk status akkurat nå.</div>
        ) : (
          <div className="motus-trainer-priority-scroll scrollbar-none">
            {priorityMembers.map((member) => (
              <button
                key={member.memberId}
                type="button"
                onClick={() => onOpenMember(member.memberId)}
                className={`motus-trainer-member-card motus-pressable ${statusToneClass(member.statusTone)}`}
              >
                <MemberAvatar name={member.memberName} avatarUrl={member.avatarUrl} size="sm" />
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-bold text-slate-900">{member.memberName}</p>
                  <p className="text-[11px] text-slate-500">{member.customerTypeLabel}</p>
                  <p className="mt-1 text-xs font-medium text-slate-700">{member.activityLabel}</p>
                  <span className={`motus-trainer-status-pill ${statusToneClass(member.statusTone)}`}>
                    {coachingStatusLabel(member.statusTone)}
                  </span>
                </div>
                <span className="motus-trainer-open-link">Åpne</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="motus-trainer-insight-card" aria-label="Innsikt">
        <div className="motus-trainer-insight-art" aria-hidden />
        <span className="motus-trainer-insight-icon" aria-hidden>
          <BarChart3 className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="motus-trainer-section-eyebrow">Innsikt</p>
          <h3 className="mt-1 text-base font-bold text-slate-950">{insightTitle}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{insightDetail}</p>
          {onOpenProgressInsight ? (
            <button type="button" onClick={onOpenProgressInsight} className="motus-trainer-insight-btn motus-pressable mt-3">
              Se innsikt
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2.5" aria-label="Hurtighandlinger">
        <TrainerQuickAction label="Klienter" icon={Users} tone="brand" onClick={quickActions.onOpenCustomers} />
        <TrainerQuickAction label="Meldinger" icon={MessageSquare} tone="pink" onClick={quickActions.onOpenMessages} />
        <TrainerQuickAction label="Programmer" icon={ClipboardList} tone="pink" onClick={quickActions.onOpenPrograms} />
      </section>
    </div>
  );
}

function TrainerStatCard({
  value,
  label,
  delta,
  tone,
  onClick,
}: {
  value: string;
  label: string;
  delta: string;
  tone: "mint" | "pink";
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className={`motus-trainer-stat-icon motus-trainer-stat-icon--${tone}`} aria-hidden>
        {tone === "pink" ? <MotusFlameIcon className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
      </span>
      <span className="mt-2 block text-xl font-bold tabular-nums leading-none text-slate-950">{value}</span>
      <span className="mt-1 block text-[11px] font-semibold text-slate-700">{label}</span>
      <span className="mt-0.5 block text-[10px] text-slate-500">{delta}</span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="motus-trainer-stat-card motus-pressable text-left">
        {inner}
      </button>
    );
  }
  return <div className="motus-trainer-stat-card">{inner}</div>;
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

/** @deprecated brukes fortsatt andre steder i TrainerPortal */
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

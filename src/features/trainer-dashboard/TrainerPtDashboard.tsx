import { type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Filter,
  IdCard,
  MessageSquare,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import { MOTUS } from "../../app/data";
import type { Member } from "../../app/types";
import type { TrainerTodoModel } from "../TrainerHomeOverview";
import type { CustomerFollowUpItem, CustomerMetrics, CustomerTimelineItem } from "./buildCustomerDashboardData";

export type TrainerListFilterTab = "all" | "active" | "risk" | "inactive";

export type TrainerPtListMember = {
  member: Member;
  avatarUrl: string | null;
  customerTypeLabel: string;
  activityLabel: string;
  statusLabel: string;
  statusTone: "active" | "warning" | "critical" | "neutral";
  selected: boolean;
};

export type TrainerPtDashboardProps = {
  listMembers: TrainerPtListMember[];
  listFilterTab: TrainerListFilterTab;
  onListFilterTabChange: (tab: TrainerListFilterTab) => void;
  listCounts: { all: number; active: number; risk: number; inactive: number };
  memberSearch: string;
  onMemberSearchChange: (value: string) => void;
  onSelectMember: (memberId: string) => void;
  onResetFilters?: () => void;
  showInactiveToggle?: boolean;
  onToggleInactive?: () => void;
  listFooter?: ReactNode;
  showCustomerChrome: boolean;
  customerSubTab?: "overview" | "programs" | "workouts" | "messages";
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAge?: string | null;
  customerTypeLabel?: string;
  customerStatusLabel?: string;
  customerStatusTone?: "active" | "warning" | "critical";
  customerAvatarUrl?: string | null;
  onMessage?: () => void;
  onOpenCustomerCard?: () => void;
  onNewTask?: () => void;
  subTabs?: ReactNode;
  metrics?: CustomerMetrics | null;
  followUpItems?: CustomerFollowUpItem[];
  timeline?: CustomerTimelineItem[];
  onTimelineAction?: (item: CustomerTimelineItem) => void;
  todos: TrainerTodoModel[];
  todoDraft: string;
  onTodoDraftChange: (value: string) => void;
  onAddTodo: () => void;
  onToggleTodo: (id: string) => void;
  latestNote?: { title: string; preview: string } | null;
  onOpenNote?: () => void;
  aggregateOverview?: ReactNode;
};

function StatusDot({ tone }: { tone: TrainerPtListMember["statusTone"] }) {
  const color =
    tone === "critical" ? "#FF5C7C" : tone === "warning" ? "#FFB84D" : tone === "active" ? "#30E3BE" : "#94A3B8";
  return <span className="motus-pt-dash-status-dot" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}55` }} />;
}

function PriorityBadge({ priority }: { priority: CustomerFollowUpItem["priority"] }) {
  const className =
    priority === "high"
      ? "motus-pt-dash-priority motus-pt-dash-priority--high"
      : priority === "medium"
        ? "motus-pt-dash-priority motus-pt-dash-priority--medium"
        : "motus-pt-dash-priority motus-pt-dash-priority--low";
  const label = priority === "high" ? "Høy prioritet" : priority === "medium" ? "Middels prioritet" : "Lav prioritet";
  return <span className={className}>{label}</span>;
}

function MiniRing({ pct, label }: { pct: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div className="motus-pt-dash-ring" aria-label={`${label}: ${clamped}%`}>
      <svg viewBox="0 0 44 44" className="h-11 w-11">
        <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(48,227,190,0.15)" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke="#30E3BE"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span className="motus-pt-dash-ring-label">{clamped}%</span>
    </div>
  );
}

const LIST_TABS: Array<{ id: TrainerListFilterTab; label: string }> = [
  { id: "all", label: "Alle" },
  { id: "active", label: "Aktive" },
  { id: "risk", label: "Risiko" },
  { id: "inactive", label: "Inaktive" },
];

export function TrainerPtDashboard({
  listMembers,
  listFilterTab,
  onListFilterTabChange,
  listCounts,
  memberSearch,
  onMemberSearchChange,
  onSelectMember,
  onResetFilters,
  showInactiveToggle,
  onToggleInactive,
  listFooter,
  showCustomerChrome,
  customerSubTab = "overview",
  customerName,
  customerEmail,
  customerPhone,
  customerAge,
  customerTypeLabel,
  customerStatusLabel,
  customerStatusTone = "active",
  customerAvatarUrl,
  onMessage,
  onOpenCustomerCard,
  onNewTask,
  subTabs,
  metrics,
  followUpItems = [],
  timeline = [],
  onTimelineAction,
  todos,
  todoDraft,
  onTodoDraftChange,
  onAddTodo,
  onToggleTodo,
  latestNote,
  onOpenNote,
  aggregateOverview,
}: TrainerPtDashboardProps) {
  const openTodos = todos.filter((todo) => !todo.done);
  const showOverviewPanels = !showCustomerChrome || customerSubTab === "overview";

  return (
    <div className="motus-pt-dash">
      <aside className="motus-pt-dash-list" aria-label="Kundeliste">
        <div className="motus-pt-dash-list-head">
          <h2 className="motus-pt-dash-list-title">Kunder</h2>
          {onResetFilters ? (
            <button type="button" className="motus-pt-dash-icon-btn" onClick={onResetFilters} aria-label="Nullstill filter">
              <Filter className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <label className="motus-pt-dash-search">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input
            type="search"
            value={memberSearch}
            onChange={(event) => onMemberSearchChange(event.target.value)}
            placeholder="Søk kunder..."
          />
        </label>
        <div className="motus-pt-dash-list-tabs" role="tablist">
          {LIST_TABS.map((tab) => {
            const count = listCounts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={listFilterTab === tab.id}
                className={`motus-pt-dash-list-tab ${listFilterTab === tab.id ? "motus-pt-dash-list-tab--active" : ""}`}
                onClick={() => onListFilterTabChange(tab.id)}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>
        <div className="motus-pt-dash-list-scroll">
          {listMembers.map((row) => (
            <button
              key={row.member.id}
              type="button"
              className={`motus-pt-dash-customer-card ${row.selected ? "motus-pt-dash-customer-card--selected" : ""}`}
              onClick={() => onSelectMember(row.member.id)}
            >
              <div className="motus-pt-dash-customer-avatar relative">
                <span className="absolute inset-0 flex items-center justify-center">
                  {row.member.name.charAt(0).toUpperCase()}
                </span>
                {row.avatarUrl ? (
                  <img
                    src={row.avatarUrl}
                    alt=""
                    className="relative z-10 h-full w-full object-cover"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">{row.member.name}</span>
                  <StatusDot tone={row.statusTone} />
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-500">{row.customerTypeLabel}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="motus-pt-dash-status-pill">{row.statusLabel}</span>
                  <span className="text-slate-400">Sist økt: {row.activityLabel}</span>
                </div>
              </div>
            </button>
          ))}
          {!listMembers.length ? (
            <div className="motus-pt-dash-empty">Ingen kunder matcher filteret.</div>
          ) : null}
        </div>
        {showInactiveToggle && onToggleInactive ? (
          <button type="button" className="motus-pt-dash-link-btn" onClick={onToggleInactive}>
            Vis inaktive kunder
          </button>
        ) : null}
        {listFooter}
      </aside>

      <div className="motus-pt-dash-main-column">
      <main className="motus-pt-dash-main">
        <div className="motus-pt-dash-main-gradient" aria-hidden />
        {showCustomerChrome && customerName ? (
          <>
            <section className="motus-pt-dash-hero">
              <div className="motus-pt-dash-hero-top">
                <div className="motus-pt-dash-hero-profile">
                  <div className="motus-pt-dash-hero-avatar relative">
                    <span className="absolute inset-0 flex items-center justify-center">
                      {customerName.charAt(0).toUpperCase()}
                    </span>
                    {customerAvatarUrl ? (
                      <img
                        src={customerAvatarUrl}
                        alt=""
                        className="relative z-10 h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <h1 className="motus-pt-dash-hero-name">{customerName}</h1>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {customerTypeLabel ? (
                        <span className="motus-pt-dash-badge motus-pt-dash-badge--pink">{customerTypeLabel}</span>
                      ) : null}
                      {customerStatusLabel ? (
                        <span className="motus-pt-dash-badge motus-pt-dash-badge--mint">
                          <StatusDot
                            tone={
                              customerStatusTone === "critical"
                                ? "critical"
                                : customerStatusTone === "warning"
                                  ? "warning"
                                  : "active"
                            }
                          />
                          {customerStatusLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-0.5 text-sm text-slate-500">
                      {customerEmail ? <div>{customerEmail}</div> : null}
                      <div className="flex flex-wrap gap-3">
                        {customerPhone ? <span>{customerPhone}</span> : null}
                        {customerAge ? <span>{customerAge}</span> : null}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="motus-pt-dash-hero-actions">
                  <button type="button" className="motus-pt-dash-btn motus-pt-dash-btn--ghost" onClick={onMessage}>
                    <MessageSquare className="h-4 w-4" />
                    Melding
                  </button>
                  <button type="button" className="motus-pt-dash-btn motus-pt-dash-btn--ghost" onClick={onOpenCustomerCard}>
                    <IdCard className="h-4 w-4" />
                    Kundekort
                  </button>
                  <button type="button" className="motus-pt-dash-btn motus-pt-dash-btn--ghost" aria-label="Flere valg">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  <button type="button" className="motus-pt-dash-btn motus-pt-dash-btn--primary" onClick={onNewTask}>
                    <Plus className="h-4 w-4" />
                    Ny oppgave
                  </button>
                </div>
              </div>
              {subTabs ? <div className="motus-pt-dash-subtabs">{subTabs}</div> : null}
            </section>

            {metrics && showOverviewPanels ? (
              <section className="motus-pt-dash-kpi-grid" aria-label="Nøkkeltall">
                <article className="motus-pt-dash-kpi-card">
                  <div className="motus-pt-dash-kpi-label">Treningsdager</div>
                  <div className="motus-pt-dash-kpi-value">{metrics.trainingDays}</div>
                  <div className="motus-pt-dash-kpi-sub">Siste 4 uker</div>
                  <div className="motus-pt-dash-kpi-chart">
                    <BarChart3 className="h-8 w-8 text-[#30E3BE]" strokeWidth={1.5} />
                  </div>
                </article>
                <article className="motus-pt-dash-kpi-card">
                  <div className="motus-pt-dash-kpi-label">Fullføringsgrad</div>
                  <MiniRing pct={metrics.completionPct} label="Fullføringsgrad" />
                  <div className="motus-pt-dash-kpi-sub">Av loggede økter</div>
                </article>
                <article className="motus-pt-dash-kpi-card">
                  <div className="motus-pt-dash-kpi-label">Aktivitetsnivå</div>
                  <div className="motus-pt-dash-kpi-value motus-pt-dash-kpi-value--text">{metrics.activityLevel}</div>
                  <div className="motus-pt-dash-kpi-sub">Score {metrics.activityScore}/10</div>
                  <Activity className="motus-pt-dash-kpi-icon text-[#30E3BE]" strokeWidth={1.5} />
                </article>
                <article className="motus-pt-dash-kpi-card">
                  <div className="motus-pt-dash-kpi-label">Programstatus</div>
                  <div className="motus-pt-dash-kpi-value motus-pt-dash-kpi-value--compact" title={metrics.programStatus}>
                    {metrics.programStatus}
                  </div>
                  <div className="motus-pt-dash-kpi-sub">Respons {metrics.responseRatePct}%</div>
                  <ClipboardList
                    className={`motus-pt-dash-kpi-icon ${metrics.programStatusTone === "pink" ? "text-[#D91278]" : "text-[#30E3BE]"}`}
                    strokeWidth={1.5}
                  />
                </article>
              </section>
            ) : null}

            {showOverviewPanels ? (
            <div className="motus-pt-dash-dual">
              <section className="motus-pt-dash-panel">
                <h2 className="motus-pt-dash-panel-title">Oppfølging nå</h2>
                <ul className="motus-pt-dash-followup-list">
                  {followUpItems.map((item) => (
                    <li key={item.id} className="motus-pt-dash-followup-item">
                      <span className="motus-pt-dash-followup-title">{item.title}</span>
                      <PriorityBadge priority={item.priority} />
                    </li>
                  ))}
                </ul>
              </section>

              <section className="motus-pt-dash-panel">
                <h2 className="motus-pt-dash-panel-title">Siste aktivitet</h2>
                <ul className="motus-pt-dash-timeline">
                  {timeline.map((item) => {
                    const Icon =
                      item.icon === "workout"
                        ? Dumbbell
                        : item.icon === "message"
                          ? MessageSquare
                          : item.icon === "program"
                            ? ClipboardList
                            : TrendingUp;
                    return (
                      <li key={item.id} className="motus-pt-dash-timeline-item">
                        <span className="motus-pt-dash-timeline-icon">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="motus-pt-dash-timeline-title">{item.title}</div>
                          <div className="text-xs text-slate-500">{item.timeLabel}</div>
                        </div>
                        <button
                          type="button"
                          className="motus-pt-dash-timeline-action"
                          onClick={() => onTimelineAction?.(item)}
                        >
                          {item.actionLabel}
                        </button>
                      </li>
                    );
                  })}
                  {!timeline.length ? (
                    <li className="motus-pt-dash-empty">Ingen aktivitet registrert ennå.</li>
                  ) : null}
                </ul>
              </section>
            </div>
            ) : null}

            {showOverviewPanels && showCustomerChrome ? (
              <div className="motus-pt-dash-secondary-row">
                <section className="motus-pt-dash-panel">
                  <h2 className="motus-pt-dash-panel-title">Dagens oppgaver</h2>
                  <div className="motus-pt-dash-todo-input-row">
                    <input
                      type="text"
                      value={todoDraft}
                      onChange={(event) => onTodoDraftChange(event.target.value)}
                      placeholder="Legg til oppgave..."
                      className="motus-pt-dash-todo-input"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") onAddTodo();
                      }}
                    />
                    <button type="button" className="motus-pt-dash-btn motus-pt-dash-btn--primary !px-3" onClick={onAddTodo}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <ul className="motus-pt-dash-todo-list">
                    {openTodos.map((todo) => (
                      <li key={todo.id} className="motus-pt-dash-todo-item">
                        <button
                          type="button"
                          className={`motus-pt-dash-todo-check ${todo.done ? "motus-pt-dash-todo-check--done" : ""}`}
                          onClick={() => onToggleTodo(todo.id)}
                          aria-label={todo.done ? "Marker som åpen" : "Marker som fullført"}
                        />
                        <span className={`flex-1 text-sm ${todo.done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                          {todo.title}
                        </span>
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            todo.priority === "high" ? "bg-[#FF5C7C]" : todo.priority === "medium" ? "bg-[#FFB84D]" : "bg-slate-300"
                          }`}
                        />
                      </li>
                    ))}
                    {!openTodos.length ? <li className="motus-pt-dash-empty text-sm">Ingen åpne oppgaver i dag.</li> : null}
                  </ul>
                </section>

                <section className="motus-pt-dash-panel">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="motus-pt-dash-panel-title">Notater</h2>
                    {onOpenNote ? (
                      <button type="button" className="motus-pt-dash-link-btn" onClick={onOpenNote}>
                        Se alle
                      </button>
                    ) : null}
                  </div>
                  {latestNote ? (
                    <button type="button" className="motus-pt-dash-note-preview" onClick={onOpenNote}>
                      <Pin className="h-3.5 w-3.5 shrink-0 text-[#D91278]" />
                      <div className="min-w-0 text-left">
                        <div className="font-semibold text-slate-900">{latestNote.title}</div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{latestNote.preview}</p>
                      </div>
                    </button>
                  ) : (
                    <p className="motus-pt-dash-empty text-sm">Ingen notater ennå.</p>
                  )}
                </section>
              </div>
            ) : null}

            <div id="motus-pt-detail-root" className="motus-pt-dash-detail-root" />
          </>
        ) : (
          aggregateOverview
        )}

      </main>
      </div>
    </div>
  );
}

export { MOTUS };

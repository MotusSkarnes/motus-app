import {
  Apple,
  BarChart3,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  FileText,
  Megaphone,
  MessageSquare,
  Share2,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { MOTUS } from "../../app/data";
import type {
  TrainerPtHomeAttentionClient,
  TrainerPtHomeKpi,
  TrainerPtHomePlanItem,
  TrainerPtHomePopularContent,
  TrainerPtHomeProgressPoint,
} from "../../app/buildTrainerPtHomeData";

export type TrainerPtHomeQuickActions = {
  onCreateProgram: () => void;
  onOpenExerciseBank: () => void;
  onOpenNutrition: () => void;
  onShareContent: () => void;
  onBulkMessage: () => void;
};

export type TrainerPtHomeScreenProps = {
  trainerFirstName: string;
  todayDateLabel: string;
  weekLabel: string;
  kpis: TrainerPtHomeKpi[];
  planItems: TrainerPtHomePlanItem[];
  attentionClients: TrainerPtHomeAttentionClient[];
  progressPoints: TrainerPtHomeProgressPoint[];
  progressDeltaPct: number;
  progressFocusLabel: string;
  popularContent: TrainerPtHomePopularContent[];
  quickActions: TrainerPtHomeQuickActions;
  onOpenCalendar: () => void;
  onOpenAllClients: () => void;
  onOpenClient: (memberId: string) => void;
  onOpenInsights: () => void;
  onSwitchToMemberView?: () => void;
};

function ClientAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <div className="motus-pt-home-avatar" aria-hidden>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <UserRound className="h-4 w-4 text-slate-400" />
      )}
      <span className="sr-only">{name}</span>
    </div>
  );
}

function KpiIcon({ tone }: { tone: TrainerPtHomeKpi["tone"] }) {
  const className = `motus-pt-home-kpi-icon motus-pt-home-kpi-icon--${tone}`;
  if (tone === "teal") return <Users className={className} aria-hidden />;
  if (tone === "pink") return <ClipboardList className={className} aria-hidden />;
  if (tone === "purple") return <Share2 className={className} aria-hidden />;
  return <TrendingUp className={className} aria-hidden />;
}

function ProgressChart({ points }: { points: TrainerPtHomeProgressPoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  const width = 280;
  const height = 120;
  const padding = 12;
  const coords = points.map((point, index) => {
    const x = padding + (index / Math.max(1, points.length - 1)) * (width - padding * 2);
    const y = height - padding - (point.value / max) * (height - padding * 2);
    return `${x},${y}`;
  });
  const linePath = coords.length ? `M ${coords.join(" L ")}` : "";
  const areaPath = coords.length
    ? `${linePath} L ${padding + (width - padding * 2)},${height - padding} L ${padding},${height - padding} Z`
    : "";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="motus-pt-home-chart" role="img" aria-label="Fremgangsgraf">
      <defs>
        <linearGradient id="motus-pt-home-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d91278" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#d91278" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {areaPath ? <path d={areaPath} fill="url(#motus-pt-home-chart-fill)" /> : null}
      {linePath ? (
        <path d={linePath} fill="none" stroke="#d91278" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
    </svg>
  );
}

function statusBadgeClass(tone: TrainerPtHomeAttentionClient["statusTone"]): string {
  if (tone === "ready") return "motus-pt-home-status motus-pt-home-status--ready";
  if (tone === "message") return "motus-pt-home-status motus-pt-home-status--message";
  if (tone === "inactive") return "motus-pt-home-status motus-pt-home-status--inactive";
  return "motus-pt-home-status motus-pt-home-status--waiting";
}

function channelBadgeClass(tone: TrainerPtHomePlanItem["channelTone"]): string {
  return `motus-pt-home-channel motus-pt-home-channel--${tone}`;
}

export function TrainerPtHomeScreen({
  trainerFirstName,
  todayDateLabel,
  weekLabel,
  kpis,
  planItems,
  attentionClients,
  progressPoints,
  progressDeltaPct,
  progressFocusLabel,
  popularContent,
  quickActions,
  onOpenCalendar,
  onOpenAllClients,
  onOpenClient,
  onOpenInsights,
  onSwitchToMemberView,
}: TrainerPtHomeScreenProps) {
  const progressDeltaLabel =
    progressDeltaPct > 0 ? `+${progressDeltaPct}%` : progressDeltaPct < 0 ? `${progressDeltaPct}%` : "0%";

  return (
    <div className="motus-pt-home motus-fade-in-up">
      <header className="motus-pt-home-header">
        <div className="min-w-0">
          <h1 className="motus-pt-home-title">
            Hei, {trainerFirstName}! <span aria-hidden>👋</span>
          </h1>
          <p className="motus-pt-home-subtitle">Her er oversikten din i dag</p>
          <p className="motus-pt-home-meta">
            {todayDateLabel}
            <span className="mx-2 text-slate-300" aria-hidden>
              |
            </span>
            {weekLabel}
          </p>
        </div>
        {onSwitchToMemberView ? (
          <button type="button" className="motus-pt-home-client-toggle motus-pressable" onClick={onSwitchToMemberView}>
            <span className="motus-pt-home-client-toggle-track" aria-hidden>
              <span className="motus-pt-home-client-toggle-thumb" />
            </span>
            Til klientvisning
          </button>
        ) : null}
      </header>

      <section className="motus-pt-home-kpi-grid" aria-label="Nøkkeltall">
        {kpis.map((kpi) => (
          <article key={kpi.id} className="motus-pt-home-kpi-card">
            <KpiIcon tone={kpi.tone} />
            <p className="motus-pt-home-kpi-value">{kpi.value}</p>
            <p className="motus-pt-home-kpi-label">{kpi.label}</p>
            <p className="motus-pt-home-kpi-delta">{kpi.delta}</p>
          </article>
        ))}
      </section>

      <section className="motus-pt-home-section" aria-label="Dagens plan">
        <div className="motus-pt-home-section-head">
          <h2 className="motus-pt-home-section-title">Dagens plan</h2>
          <button type="button" className="motus-pt-home-link motus-pressable" onClick={onOpenCalendar}>
            Se kalender
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        {planItems.length === 0 ? (
          <p className="motus-pt-home-empty">Ingen planlagte punkter i dag — legg til oppgaver eller følg opp kunder.</p>
        ) : (
          <div className="motus-pt-home-plan-row scrollbar-none">
            {planItems.map((item) => (
              <article key={item.id} className="motus-pt-home-plan-card">
                <div className="motus-pt-home-plan-top">
                  <span className="motus-pt-home-plan-time">{item.timeLabel}</span>
                  <span className={channelBadgeClass(item.channelTone)}>{item.channelLabel}</span>
                </div>
                <p className="motus-pt-home-plan-title">{item.title}</p>
                <div className="motus-pt-home-plan-client">
                  <ClientAvatar name={item.clientName} avatarUrl={item.avatarUrl} />
                  <span>{item.clientName}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="motus-pt-home-section" aria-label="Klienter som trenger oppmerksomhet">
        <div className="motus-pt-home-section-head">
          <h2 className="motus-pt-home-section-title">Klienter som trenger din oppmerksomhet</h2>
          <button type="button" className="motus-pt-home-link motus-pressable" onClick={onOpenAllClients}>
            Se alle klienter
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        {attentionClients.length === 0 ? (
          <p className="motus-pt-home-empty">Alle klienter ser ut til å være i god flyt akkurat nå.</p>
        ) : (
          <div className="motus-pt-home-attention-row scrollbar-none">
            {attentionClients.map((client) => (
              <article key={client.memberId} className="motus-pt-home-attention-card">
                <ClientAvatar name={client.memberName} avatarUrl={client.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="motus-pt-home-attention-name">{client.memberName}</p>
                  <span className={statusBadgeClass(client.statusTone)}>{client.statusLabel}</span>
                  <p className="motus-pt-home-attention-meta">{client.lastActiveLabel}</p>
                </div>
                <button
                  type="button"
                  className="motus-pt-home-open-btn motus-pressable"
                  onClick={() => onOpenClient(client.memberId)}
                >
                  Åpne profil
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="motus-pt-home-section" aria-label="Innsikt og innhold">
        <h2 className="motus-pt-home-section-title mb-3">Innsikt og innhold</h2>
        <div className="motus-pt-home-insight-grid">
          <article className="motus-pt-home-insight-chart-card">
            <h3 className="motus-pt-home-card-title">Fremgang denne måneden</h3>
            <ProgressChart points={progressPoints} />
            <p className="motus-pt-home-insight-stat">
              <span className="font-bold text-emerald-600">{progressDeltaLabel}</span> vs. forrige måned
            </p>
            <p className="motus-pt-home-insight-meta">
              Mest populære fokus: <strong>{progressFocusLabel}</strong>
            </p>
          </article>
          <article className="motus-pt-home-insight-list-card">
            <h3 className="motus-pt-home-card-title">Populært innhold denne uken</h3>
            <ul className="motus-pt-home-popular-list">
              {popularContent.length === 0 ? (
                <li className="motus-pt-home-empty">Del innhold fra Innhold-fanen for å se trender her.</li>
              ) : (
                popularContent.map((item) => (
                  <li key={item.id} className="motus-pt-home-popular-item">
                    <span className="motus-pt-home-popular-thumb" aria-hidden>
                      <FileText className="h-4 w-4 text-slate-400" />
                    </span>
                    <div className="min-w-0">
                      <p className="motus-pt-home-popular-title">{item.title}</p>
                      <p className="motus-pt-home-popular-meta">{item.shareLabel}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </article>
        </div>
      </section>

      <section className="motus-pt-home-section" aria-label="Nylig brukte verktøy">
        <h2 className="motus-pt-home-section-title mb-3">Dine nylig brukte verktøy</h2>
        <div className="motus-pt-home-tools-grid">
          <button type="button" className="motus-pt-home-tool motus-pressable" onClick={quickActions.onCreateProgram}>
            <span className="motus-pt-home-tool-icon motus-pt-home-tool-icon--teal">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </span>
            <span>Lag program</span>
          </button>
          <button type="button" className="motus-pt-home-tool motus-pressable" onClick={quickActions.onOpenExerciseBank}>
            <span className="motus-pt-home-tool-icon motus-pt-home-tool-icon--pink">
              <Dumbbell className="h-5 w-5" aria-hidden />
            </span>
            <span>Øvelsesbank</span>
          </button>
          <button type="button" className="motus-pt-home-tool motus-pressable" onClick={quickActions.onOpenNutrition}>
            <span className="motus-pt-home-tool-icon motus-pt-home-tool-icon--purple">
              <Apple className="h-5 w-5" aria-hidden />
            </span>
            <span>Ernæringsplan</span>
          </button>
          <button type="button" className="motus-pt-home-tool motus-pressable" onClick={quickActions.onShareContent}>
            <span className="motus-pt-home-tool-icon motus-pt-home-tool-icon--mint">
              <Megaphone className="h-5 w-5" aria-hidden />
            </span>
            <span>Del innlegg</span>
          </button>
          <button type="button" className="motus-pt-home-tool motus-pressable" onClick={quickActions.onBulkMessage}>
            <span className="motus-pt-home-tool-icon motus-pt-home-tool-icon--slate">
              <MessageSquare className="h-5 w-5" aria-hidden />
            </span>
            <span>Masse-melding</span>
          </button>
        </div>
      </section>

      <section className="motus-pt-home-promo" aria-label="Automatiske innsikter">
        <div className="motus-pt-home-promo-copy">
          <p className="motus-pt-home-promo-eyebrow">Automatiske innsikter</p>
          <h3 className="motus-pt-home-promo-title">Få forslag til oppfølging basert på klientenes aktivitet</h3>
          <p className="motus-pt-home-promo-text">
            Motus samler signaler fra økter, meldinger og programmer — slik at du ser hvem som trenger deg først.
          </p>
          <button type="button" className="motus-pt-home-promo-btn motus-pressable" onClick={onOpenInsights}>
            Utforsk innsikter
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="motus-pt-home-promo-preview" aria-hidden>
          <div className="motus-pt-home-promo-preview-card">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Innsikt for klient</p>
            <p className="mt-1 text-sm font-bold text-slate-900">Styrke +12% · Konsistens 92%</p>
            <div className="mt-2 flex gap-1">
              <BarChart3 className="h-4 w-4" style={{ color: MOTUS.turquoise }} />
              <Video className="h-4 w-4 text-slate-400" />
              <Sparkles className="h-4 w-4" style={{ color: MOTUS.pink }} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

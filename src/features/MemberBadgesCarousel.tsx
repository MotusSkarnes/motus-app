import type { LucideIcon } from "lucide-react";
import { Award, CalendarCheck, Check, Dumbbell, Flame, Lock, PlayCircle, RefreshCw, Trophy, Zap } from "lucide-react";
import { MOTUS } from "../app/data";
import type { BadgeIconId, BadgeLevelId, MemberBadge, MemberBadgeCollection } from "../app/memberBadges";

const MOTUS_GRADIENT = `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`;

const BADGE_ICONS: Record<BadgeIconId, LucideIcon> = {
  "first-session": PlayCircle,
  "week-streak": Flame,
  sessions: Trophy,
  lift: Dumbbell,
  "lift-heavy": Zap,
  "month-goal": CalendarCheck,
  monthly: RefreshCw,
};

const LEVEL_STYLES: Record<BadgeLevelId, { label: string; color: string; border: string; glow: string }> = {
  bronze: { label: "Bronse", color: "#B77955", border: "rgba(183,121,85,0.45)", glow: "rgba(183,121,85,0.14)" },
  silver: { label: "Sølv", color: "#94A3B8", border: "rgba(148,163,184,0.45)", glow: "rgba(148,163,184,0.16)" },
  gold: { label: "Gull", color: "#D6A737", border: "rgba(214,167,55,0.50)", glow: "rgba(214,167,55,0.16)" },
  diamond: { label: "Diamant", color: MOTUS.turquoise, border: "rgba(48,227,190,0.45)", glow: "rgba(48,227,190,0.16)" },
  legendary: { label: "Legendarisk", color: MOTUS.pink, border: "rgba(217,18,120,0.45)", glow: "rgba(217,18,120,0.16)" },
};

type MemberBadgesCarouselProps = {
  collection: MemberBadgeCollection;
};

function AchievementBadge({ badge, index }: { badge: MemberBadge; index: number }) {
  const Icon = BADGE_ICONS[badge.icon];
  const level = LEVEL_STYLES[badge.level];
  const progressPct = badge.target > 0 ? Math.min(100, Math.round((badge.current / badge.target) * 100)) : 0;

  return (
    <article
      className={`relative flex min-h-[9.5rem] flex-col overflow-hidden rounded-xl border p-3 shadow-sm ${
        badge.unlocked ? "bg-white" : "bg-slate-50/80"
      }`}
      style={{ borderColor: badge.unlocked ? level.border : "rgba(15,23,42,0.08)" }}
    >
      <div
        className="absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl"
        style={{ background: badge.unlocked ? level.glow : "rgba(148,163,184,0.10)" }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <span className="rounded-full bg-slate-950 px-1.5 py-0.5 text-[10px] font-bold text-white">{index + 1}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
            badge.unlocked ? "text-white" : "bg-white text-slate-500"
          }`}
          style={badge.unlocked ? { background: level.color } : { border: "1px solid rgba(15,23,42,0.08)" }}
        >
          {badge.unlocked ? <Check className="h-3 w-3" strokeWidth={3} /> : <Lock className="h-3 w-3" />}
          {badge.levelLabel}
        </span>
      </div>

      <div className="relative mt-2 flex items-center gap-2">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center text-white shadow-sm"
          style={{
            background: badge.unlocked ? `linear-gradient(135deg, ${level.color} 0%, ${MOTUS.pink} 120%)` : "#cbd5e1",
            clipPath: "polygon(50% 0%, 88% 18%, 88% 72%, 50% 100%, 12% 72%, 12% 18%)",
          }}
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className={`line-clamp-2 text-sm font-bold leading-tight ${badge.unlocked ? "text-slate-950" : "text-slate-600"}`}>
            {badge.title}
          </h3>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: badge.unlocked ? level.color : "#94a3b8" }}>
            {level.label}
          </p>
        </div>
      </div>

      <p className="relative mt-2 line-clamp-2 text-[11px] leading-snug text-slate-500">{badge.description}</p>

      <div className="relative mt-auto pt-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${badge.unlocked ? 100 : progressPct}%`, background: badge.unlocked ? level.color : MOTUS_GRADIENT }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] font-semibold text-slate-500">
          <span>{Math.min(badge.current, badge.target)}/{badge.target}</span>
          <span>{badge.unlocked ? "Låst opp" : `${progressPct}%`}</span>
        </div>
      </div>
    </article>
  );
}

export function MemberBadgesCarousel({ collection }: MemberBadgesCarouselProps) {
  if (!collection.totalCount) return null;
  const overallPct = Math.round((collection.totalUnlocked / collection.totalCount) * 100);

  return (
    <section
      className="min-w-0 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm sm:p-5"
      style={{ borderColor: "rgba(15,23,42,0.08)" }}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex shrink-0 rounded-xl p-2 text-white shadow-sm" style={{ background: MOTUS_GRADIENT }}>
          <Award className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">Badges</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {collection.totalUnlocked} av {collection.totalCount} låst opp
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${overallPct}%`, background: MOTUS_GRADIENT }} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {Object.entries(LEVEL_STYLES).map(([key, level]) => (
          <span key={key} className="rounded-full border bg-white px-2 py-1 text-[10px] font-semibold" style={{ borderColor: level.border, color: level.color }}>
            {level.label}
          </span>
        ))}
      </div>

      <div className="mt-5 space-y-5">
        {collection.categories.map((category) => (
          <div key={category.id}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">{category.title}</h3>
                <p className="text-[11px] text-slate-500">
                  {category.unlockedCount}/{category.badges.length} låst opp
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {category.badges.map((badge, index) => (
                <AchievementBadge key={badge.id} badge={badge} index={index} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

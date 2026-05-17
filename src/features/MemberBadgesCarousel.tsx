import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Award, CalendarCheck, Check, Dumbbell, Flame, Lock, PlayCircle, RefreshCw, Trophy, Zap } from "lucide-react";
import { MOTUS } from "../app/data";
import type { BadgeIconId, BadgeLevelId, MemberBadge, MemberBadgeCategoryId, MemberBadgeCollection } from "../app/memberBadges";

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

const LEVEL_ORDER: BadgeLevelId[] = ["bronze", "silver", "gold", "diamond", "legendary"];

const LEVEL_ROMAN: Record<BadgeLevelId, string> = {
  bronze: "I",
  silver: "II",
  gold: "III",
  diamond: "IV",
  legendary: "V",
};

const LEVEL_STYLES: Record<BadgeLevelId, { label: string; color: string; border: string; glow: string; soft: string }> = {
  bronze: { label: "Bronse", color: "#C1784D", border: "rgba(193,120,77,0.58)", glow: "rgba(193,120,77,0.22)", soft: "rgba(193,120,77,0.12)" },
  silver: { label: "Sølv", color: "#CBD5E1", border: "rgba(203,213,225,0.58)", glow: "rgba(203,213,225,0.20)", soft: "rgba(203,213,225,0.12)" },
  gold: { label: "Gull", color: "#F2C14E", border: "rgba(242,193,78,0.62)", glow: "rgba(242,193,78,0.22)", soft: "rgba(242,193,78,0.14)" },
  diamond: { label: "Diamant", color: MOTUS.turquoise, border: "rgba(48,227,190,0.58)", glow: "rgba(48,227,190,0.23)", soft: "rgba(48,227,190,0.13)" },
  legendary: { label: "Legend", color: MOTUS.pink, border: "rgba(217,18,120,0.62)", glow: "rgba(217,18,120,0.24)", soft: "rgba(217,18,120,0.14)" },
};

type MemberBadgesCarouselProps = {
  collection: MemberBadgeCollection;
};

type ActiveCategoryId = "all" | MemberBadgeCategoryId;

function formatBadgeValue(badge: MemberBadge, value: number) {
  if (badge.id === "goal-percent") return `${value}%`;
  if (badge.id === "lift") return `${value} kg`;
  return `${value}`;
}

function LevelMarker({ badge, levelIndex }: { badge: MemberBadge; levelIndex: number }) {
  const level = badge.levels[levelIndex];
  if (!level) return null;

  const style = LEVEL_STYLES[level.level];

  return (
    <span
      className="flex h-8 min-w-0 items-center justify-center border text-[10px] font-black leading-none"
      style={{
        background: level.unlocked ? `linear-gradient(145deg, ${style.soft} 0%, rgba(15,23,42,0.82) 100%)` : "rgba(255,255,255,0.05)",
        borderColor: level.unlocked ? style.border : "rgba(148,163,184,0.18)",
        color: level.unlocked ? style.color : "rgba(148,163,184,0.62)",
        clipPath: "polygon(50% 0%, 90% 18%, 82% 78%, 50% 100%, 18% 78%, 10% 18%)",
      }}
      title={`${level.levelLabel} ${level.levelName}`}
    >
      {LEVEL_ROMAN[level.level]}
    </span>
  );
}

function AchievementBadge({ badge, index }: { badge: MemberBadge; index: number }) {
  const Icon = BADGE_ICONS[badge.icon];
  const level = LEVEL_STYLES[badge.level];
  const isComplete = badge.achievedLevelIndex >= badge.levels.length - 1;

  return (
    <article
      className="relative flex h-[19rem] w-60 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border p-4 text-white shadow-sm"
      style={{
        background: badge.unlocked
          ? `radial-gradient(circle at 50% 8%, ${level.glow} 0%, rgba(7,17,31,0) 34%), linear-gradient(150deg, #07111f 0%, #111827 62%, #172033 100%)`
          : "linear-gradient(150deg, #111827 0%, #1f2937 100%)",
        borderColor: badge.unlocked ? level.border : "rgba(148,163,184,0.18)",
      }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl" style={{ background: badge.unlocked ? level.glow : "rgba(148,163,184,0.10)" }} />

      <div className="relative flex items-start justify-between gap-2">
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300">{String(index + 1).padStart(2, "0")}</span>
        <span
          className="inline-flex max-w-[8.5rem] items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase leading-none"
          style={{ borderColor: badge.unlocked ? level.border : "rgba(148,163,184,0.18)", color: badge.unlocked ? level.color : "#CBD5E1" }}
        >
          {badge.unlocked ? <Check className="h-3 w-3" strokeWidth={3} /> : <Lock className="h-3 w-3" />}
          <span className="truncate">{badge.levelLabel}</span>
        </span>
      </div>

      <div className="relative mt-4 flex flex-col items-center text-center">
        <span
          className="flex h-24 w-24 items-center justify-center border shadow-lg"
          style={{
            background: badge.unlocked ? `linear-gradient(145deg, ${level.soft} 0%, rgba(15,23,42,0.95) 62%, ${level.glow} 100%)` : "rgba(255,255,255,0.06)",
            borderColor: badge.unlocked ? level.border : "rgba(148,163,184,0.18)",
            clipPath: "polygon(50% 0%, 90% 17%, 90% 73%, 50% 100%, 10% 73%, 10% 17%)",
          }}
        >
          <Icon className="h-10 w-10" strokeWidth={2.15} aria-hidden style={{ color: badge.unlocked ? level.color : "#94A3B8" }} />
        </span>

        <h3 className="mt-3 line-clamp-2 min-h-[2.5rem] text-lg font-black uppercase leading-tight text-white">{badge.title}</h3>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: badge.unlocked ? level.color : "#94A3B8" }}>
          {badge.levelName}
        </p>
        <p className="mt-2 line-clamp-2 min-h-[2rem] text-xs leading-snug text-slate-300">{badge.description}</p>
      </div>

      <div className="relative mt-auto">
        <div className="grid grid-cols-5 gap-1.5">
          {LEVEL_ORDER.map((levelId, levelIndex) => (
            <LevelMarker key={levelId} badge={badge} levelIndex={levelIndex} />
          ))}
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-all" style={{ width: `${badge.progressPct}%`, background: badge.unlocked ? level.color : MOTUS_GRADIENT }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-300">
          <span>{formatBadgeValue(badge, badge.current)}</span>
          <span className="text-right">{isComplete ? "Maks nivå" : `${formatBadgeValue(badge, badge.target)}`}</span>
        </div>
      </div>
    </article>
  );
}

export function MemberBadgesCarousel({ collection }: MemberBadgesCarouselProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<ActiveCategoryId>("all");

  const menuItems = useMemo(
    () => [
      { id: "all" as const, title: "Alle", count: collection.allBadges.length },
      ...collection.categories.map((category) => ({ id: category.id, title: category.title, count: category.badges.length })),
    ],
    [collection.allBadges.length, collection.categories],
  );

  const visibleBadges = useMemo(() => {
    if (activeCategoryId === "all") return collection.allBadges;
    return collection.categories.find((category) => category.id === activeCategoryId)?.badges ?? [];
  }, [activeCategoryId, collection.allBadges, collection.categories]);

  if (!collection.totalCount) return null;

  const overallPct = collection.totalLevels > 0 ? Math.round((collection.totalUnlockedLevels / collection.totalLevels) * 100) : 0;

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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Badges</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {collection.totalUnlockedLevels} av {collection.totalLevels} nivåer låst opp
              </p>
            </div>
            <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-white">{overallPct}%</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${overallPct}%`, background: MOTUS_GRADIENT }} />
          </div>
        </div>
      </div>

      <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {menuItems.map((item) => {
          const active = item.id === activeCategoryId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveCategoryId(item.id)}
              className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                active ? "text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
              style={{ background: active ? MOTUS_GRADIENT : undefined, borderColor: active ? "transparent" : "rgba(15,23,42,0.10)" }}
            >
              {item.title} <span className={active ? "text-white/75" : "text-slate-400"}>{item.count}</span>
            </button>
          );
        })}
      </div>

      <div className="-mx-1 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3">
        {visibleBadges.map((badge, index) => (
          <AchievementBadge key={badge.id} badge={badge} index={index} />
        ))}
      </div>
    </section>
  );
}

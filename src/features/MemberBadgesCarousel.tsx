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

const LEVEL_STYLES: Record<BadgeLevelId, { label: string; color: string; border: string; glow: string; soft: string; surface: string }> = {
  bronze: {
    label: "Bronse",
    color: "#B86E45",
    border: "rgba(184,110,69,0.34)",
    glow: "rgba(184,110,69,0.16)",
    soft: "rgba(184,110,69,0.10)",
    surface: "linear-gradient(145deg, rgba(184,110,69,0.14) 0%, rgba(255,255,255,0.96) 45%, rgba(48,227,190,0.08) 100%)",
  },
  silver: {
    label: "Sølv",
    color: "#64748B",
    border: "rgba(100,116,139,0.28)",
    glow: "rgba(100,116,139,0.13)",
    soft: "rgba(100,116,139,0.09)",
    surface: "linear-gradient(145deg, rgba(100,116,139,0.12) 0%, rgba(255,255,255,0.97) 48%, rgba(48,227,190,0.08) 100%)",
  },
  gold: {
    label: "Gull",
    color: "#B88916",
    border: "rgba(184,137,22,0.32)",
    glow: "rgba(184,137,22,0.16)",
    soft: "rgba(184,137,22,0.10)",
    surface: "linear-gradient(145deg, rgba(184,137,22,0.15) 0%, rgba(255,255,255,0.96) 46%, rgba(217,18,120,0.07) 100%)",
  },
  diamond: {
    label: "Diamant",
    color: MOTUS.turquoise,
    border: "rgba(48,227,190,0.34)",
    glow: "rgba(48,227,190,0.18)",
    soft: "rgba(48,227,190,0.11)",
    surface: "linear-gradient(145deg, rgba(48,227,190,0.16) 0%, rgba(255,255,255,0.96) 48%, rgba(217,18,120,0.07) 100%)",
  },
  legendary: {
    label: "Legend",
    color: MOTUS.pink,
    border: "rgba(217,18,120,0.34)",
    glow: "rgba(217,18,120,0.17)",
    soft: "rgba(217,18,120,0.11)",
    surface: "linear-gradient(145deg, rgba(217,18,120,0.15) 0%, rgba(255,255,255,0.96) 47%, rgba(48,227,190,0.09) 100%)",
  },
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
      className="flex h-8 min-w-0 items-center justify-center border text-[10px] font-black leading-none shadow-sm"
      style={{
        background: level.unlocked ? `linear-gradient(145deg, #ffffff 0%, ${style.soft} 100%)` : "rgba(241,245,249,0.84)",
        borderColor: level.unlocked ? style.border : "rgba(148,163,184,0.20)",
        color: level.unlocked ? style.color : "#94A3B8",
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
      className="relative flex h-[19rem] w-60 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border p-4 text-slate-900 shadow-sm"
      style={{
        background: badge.unlocked ? level.surface : "linear-gradient(145deg, rgba(248,250,252,0.98) 0%, rgba(255,255,255,0.96) 56%, rgba(226,232,240,0.72) 100%)",
        borderColor: badge.unlocked ? level.border : "rgba(15,23,42,0.08)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl"
        style={{ background: badge.unlocked ? level.glow : "rgba(148,163,184,0.13)" }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5" style={{ background: badge.unlocked ? MOTUS_GRADIENT : "rgba(203,213,225,0.62)" }} />
      <div className="pointer-events-none absolute left-4 right-4 top-[5.25rem] h-px" style={{ background: badge.unlocked ? `linear-gradient(90deg, transparent 0%, ${level.border} 50%, transparent 100%)` : "rgba(148,163,184,0.15)" }} />

      <div className="relative flex items-start justify-between gap-2">
        <span className="rounded-full border bg-white/75 px-2 py-1 text-[10px] font-bold text-slate-500 shadow-sm">{String(index + 1).padStart(2, "0")}</span>
        <span
          className="inline-flex max-w-[8.5rem] items-center gap-1 rounded-full border bg-white/80 px-2 py-1 text-[10px] font-bold uppercase leading-none shadow-sm"
          style={{ borderColor: badge.unlocked ? level.border : "rgba(148,163,184,0.20)", color: badge.unlocked ? level.color : "#64748B" }}
        >
          {badge.unlocked ? <Check className="h-3 w-3" strokeWidth={3} /> : <Lock className="h-3 w-3" />}
          <span className="truncate">{badge.levelLabel}</span>
        </span>
      </div>

      <div className="relative mt-4 flex flex-col items-center text-center">
        <span
          className="relative flex h-24 w-24 items-center justify-center border shadow-sm"
          style={{
            background: badge.unlocked
              ? `radial-gradient(circle at 50% 24%, #ffffff 0%, ${level.soft} 54%, rgba(255,255,255,0.62) 100%)`
              : "linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)",
            borderColor: badge.unlocked ? level.border : "rgba(148,163,184,0.20)",
            clipPath: "polygon(50% 0%, 90% 17%, 90% 73%, 50% 100%, 10% 73%, 10% 17%)",
          }}
        >
          <span
            className="absolute inset-2 border opacity-70"
            style={{
              borderColor: badge.unlocked ? level.border : "rgba(148,163,184,0.18)",
              clipPath: "polygon(50% 0%, 90% 17%, 90% 73%, 50% 100%, 10% 73%, 10% 17%)",
            }}
          />
          <Icon className="relative h-10 w-10" strokeWidth={2.15} aria-hidden style={{ color: badge.unlocked ? level.color : "#94A3B8" }} />
        </span>

        <h3 className="mt-3 line-clamp-2 min-h-[2.5rem] text-lg font-black uppercase leading-tight text-slate-950">{badge.title}</h3>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: badge.unlocked ? level.color : "#64748B" }}>
          {badge.levelName}
        </p>
        <p className="mt-2 line-clamp-2 min-h-[2rem] text-xs leading-snug text-slate-600">{badge.description}</p>
      </div>

      <div className="relative mt-auto">
        <div className="grid grid-cols-5 gap-1.5">
          {LEVEL_ORDER.map((levelId, levelIndex) => (
            <LevelMarker key={levelId} badge={badge} levelIndex={levelIndex} />
          ))}
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full transition-all" style={{ width: `${badge.progressPct}%`, background: badge.unlocked ? MOTUS_GRADIENT : "rgba(148,163,184,0.55)" }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500">
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

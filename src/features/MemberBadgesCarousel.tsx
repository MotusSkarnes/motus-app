import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Award, CalendarCheck, Check, Crown, Diamond, Dumbbell, Flame, Lock, RefreshCw, Shield, Star, Trophy } from "lucide-react";
import { MOTUS } from "../app/data";
import type { BadgeIconId, BadgeLevelId, MemberBadge, MemberBadgeCategoryId, MemberBadgeCollection } from "../app/memberBadges";

const MOTUS_GRADIENT = `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`;
const HEX_CLIP = "polygon(50% 0%, 93% 16%, 93% 84%, 50% 100%, 7% 84%, 7% 16%)";

const BADGE_ICONS: Record<BadgeIconId, LucideIcon> = {
  "first-session": Check,
  "week-streak": Flame,
  sessions: CalendarCheck,
  lift: Dumbbell,
  "lift-heavy": Dumbbell,
  "month-goal": Trophy,
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

const LEVEL_SYMBOLS: Record<BadgeLevelId, LucideIcon> = {
  bronze: Star,
  silver: Shield,
  gold: Star,
  diamond: Diamond,
  legendary: Crown,
};

const LEVEL_STYLES: Record<
  BadgeLevelId,
  { label: string; color: string; border: string; iconGlow: string; dark?: boolean }
> = {
  bronze: {
    label: "Bronse",
    color: "#B8734D",
    border: "rgba(184,115,77,0.55)",
    iconGlow: "rgba(184,115,77,0.25)",
  },
  silver: {
    label: "Sølv",
    color: "#8B9AAB",
    border: "rgba(139,154,171,0.55)",
    iconGlow: "rgba(139,154,171,0.22)",
  },
  gold: {
    label: "Gull",
    color: "#D89A17",
    border: "rgba(216,154,23,0.58)",
    iconGlow: "rgba(216,154,23,0.28)",
  },
  diamond: {
    label: "Diamant",
    color: MOTUS.turquoise,
    border: "rgba(48,227,190,0.65)",
    iconGlow: "rgba(48,227,190,0.35)",
    dark: true,
  },
  legendary: {
    label: "Legendarisk",
    color: MOTUS.pink,
    border: "rgba(217,18,120,0.65)",
    iconGlow: "rgba(217,18,120,0.35)",
    dark: true,
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

function LevelLegendItem({ levelId }: { levelId: BadgeLevelId }) {
  const style = LEVEL_STYLES[levelId];
  const Symbol = LEVEL_SYMBOLS[levelId];
  const useDark = style.dark === true;

  return (
    <span className="inline-flex shrink-0 flex-col items-center gap-1.5 px-1">
      <span
        className="relative flex h-9 w-9 items-center justify-center border-2 shadow-[0_4px_10px_rgba(15,23,42,0.08)]"
        style={{
          clipPath: HEX_CLIP,
          background: useDark
            ? "linear-gradient(165deg, #1e293b 0%, #0f172a 100%)"
            : "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
          borderColor: style.border,
          color: style.color,
          boxShadow: useDark ? `0 0 14px ${style.iconGlow}` : undefined,
        }}
      >
        <Symbol className="relative h-4 w-4" strokeWidth={2.2} />
      </span>
      <span className="max-w-[4.5rem] text-center leading-tight">
        <span className="block text-[9px] font-black uppercase tracking-wide text-slate-800">Nivå {LEVEL_ROMAN[levelId]}</span>
        <span className="block text-[9px] font-bold uppercase tracking-wide" style={{ color: style.color }}>
          {style.label}
        </span>
      </span>
    </span>
  );
}

function BadgeHex({ badge }: { badge: MemberBadge }) {
  const Icon = BADGE_ICONS[badge.icon];
  const level = LEVEL_STYLES[badge.level];
  const useDark = badge.unlocked && level.dark === true;

  return (
    <span
      className="relative flex h-[4.75rem] w-[4.25rem] items-center justify-center"
      style={{
        filter: badge.unlocked ? "drop-shadow(0 8px 14px rgba(15,23,42,0.12))" : "drop-shadow(0 4px 8px rgba(15,23,42,0.06))",
      }}
    >
      <span
        className="absolute inset-0 border-2"
        style={{
          clipPath: HEX_CLIP,
          background: !badge.unlocked
            ? "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)"
            : useDark
              ? "linear-gradient(165deg, #1e293b 0%, #0f172a 100%)"
              : "linear-gradient(180deg, #ffffff 0%, #f8fafc 55%, #eef2f7 100%)",
          borderColor: badge.unlocked ? level.border : "rgba(148,163,184,0.35)",
          boxShadow: badge.unlocked && useDark ? `0 0 18px ${level.iconGlow}, inset 0 1px 0 rgba(255,255,255,0.08)` : "inset 0 1px 0 rgba(255,255,255,0.9)",
        }}
      />
      <span
        className="absolute inset-[5px] border"
        style={{
          clipPath: HEX_CLIP,
          borderColor: badge.unlocked ? level.border : "rgba(148,163,184,0.2)",
          opacity: badge.unlocked ? 0.55 : 0.4,
        }}
      />
      {badge.unlocked ? (
        <span className="absolute h-10 w-10 rounded-full blur-lg" style={{ background: level.iconGlow }} aria-hidden />
      ) : null}
      <Icon
        className="relative h-8 w-8"
        strokeWidth={2.35}
        aria-hidden
        style={{
          color: badge.unlocked ? level.color : "#94A3B8",
          filter: badge.unlocked && useDark ? `drop-shadow(0 0 6px ${level.iconGlow})` : undefined,
        }}
      />
      {!badge.unlocked ? (
        <span className="absolute bottom-1 right-0 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-400 shadow-sm">
          <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
        </span>
      ) : null}
    </span>
  );
}

function BadgeProgress({ badge }: { badge: MemberBadge }) {
  return (
    <div className="mt-2 w-full px-0.5">
      <div className="h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${badge.progressPct}%`,
            background: badge.unlocked ? MOTUS_GRADIENT : "rgba(148,163,184,0.45)",
          }}
        />
      </div>
      <div className="mt-1 flex justify-between gap-1 text-[8px] font-semibold text-slate-400">
        <span>{formatBadgeValue(badge, badge.current)}</span>
        <span>{formatBadgeValue(badge, badge.target)}</span>
      </div>
    </div>
  );
}

function AchievementBadge({ badge }: { badge: MemberBadge }) {
  const level = LEVEL_STYLES[badge.level];
  const isComplete = badge.achievedLevelIndex >= badge.levels.length - 1;

  return (
    <article className="relative flex w-[5.5rem] shrink-0 snap-start flex-col items-center text-center">
      <BadgeHex badge={badge} />
      <h3 className="mt-2 line-clamp-2 text-[10px] font-black uppercase leading-tight tracking-wide text-slate-800">{badge.title}</h3>
      {badge.unlocked ? (
        <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ color: level.color }}>
          {badge.levelName}
        </p>
      ) : null}
      {isComplete ? (
        <span className="mt-1.5 inline-flex items-center gap-0.5 text-[9px] font-bold uppercase" style={{ color: level.color }}>
          <Check className="h-3 w-3" strokeWidth={3} />
          Maks
        </span>
      ) : (
        <BadgeProgress badge={badge} />
      )}
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
    <section className="min-w-0 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm sm:p-5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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

      <div className="mt-5 flex justify-between gap-1 overflow-x-auto pb-1">
        {LEVEL_ORDER.map((levelId) => (
          <LevelLegendItem key={levelId} levelId={levelId} />
        ))}
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

      <div className="-mx-1 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
        {visibleBadges.map((badge) => (
          <AchievementBadge key={badge.id} badge={badge} />
        ))}
      </div>
    </section>
  );
}

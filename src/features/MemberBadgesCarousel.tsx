import { useId, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Award, CalendarCheck, Check, Crown, Diamond, Dumbbell, Flame, Lock, RefreshCw, Shield, Star, Trophy } from "lucide-react";
import { MOTUS } from "../app/data";
import type { BadgeIconId, BadgeLevelId, MemberBadge, MemberBadgeCategoryId, MemberBadgeCollection } from "../app/memberBadges";

const MOTUS_GRADIENT = `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`;

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

type LevelStyle = {
  label: string;
  accent: string;
  border: string;
  icon: string;
  darkFace?: boolean;
};

const LEVEL_STYLES: Record<BadgeLevelId, LevelStyle> = {
  bronze: { label: "Bronse", accent: "#B8734D", border: "#C98A5E", icon: "#B8734D" },
  silver: { label: "Sølv", accent: "#8B9AAB", border: "#A8B4C2", icon: "#7B8A9A" },
  gold: { label: "Gull", accent: "#D89A17", border: "#E8B23A", icon: "#D89A17" },
  diamond: { label: "Diamant", accent: MOTUS.turquoise, border: MOTUS.turquoise, icon: MOTUS.turquoise },
  legendary: { label: "Legendarisk", accent: MOTUS.pink, border: MOTUS.pink, icon: MOTUS.pink, darkFace: true },
};

const HEX_POINTS = "50,3 93,26 93,74 50,97 7,74 7,26";

type MemberBadgesCarouselProps = {
  collection: MemberBadgeCollection;
};

type ActiveCategoryId = "all" | MemberBadgeCategoryId;

function formatBadgeValue(badge: MemberBadge, value: number) {
  if (badge.id === "goal-percent") return `${value}%`;
  if (badge.id === "lift") return `${value} kg`;
  return `${value}`;
}

function HexFrame({ level, unlocked, size = 76, uid }: { level: LevelStyle; unlocked: boolean; size?: number; uid: string }) {
  const useDark = unlocked && level.darkFace === true;
  const border = unlocked ? level.border : "#CBD5E1";
  const height = Math.round(size * 1.15);

  return (
    <svg width={size} height={height} viewBox="0 0 100 115" className="block shrink-0" aria-hidden>
      <defs>
        <linearGradient id={`${uid}-face`} x1="0%" y1="0%" x2="0%" y2="100%">
          {useDark ? (
            <>
              <stop offset="0%" stopColor="#2d3a4f" />
              <stop offset="55%" stopColor="#141c28" />
              <stop offset="100%" stopColor="#0b1018" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="45%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#e8edf3" />
            </>
          )}
        </linearGradient>
        <linearGradient id={`${uid}-shine`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="rgba(15,23,42,0.14)" />
        </filter>
        {unlocked && useDark ? (
          <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={level.accent} floodOpacity="0.45" />
          </filter>
        ) : null}
      </defs>
      <polygon
        points={HEX_POINTS}
        fill={`url(#${uid}-face)`}
        stroke={border}
        strokeWidth="2.8"
        strokeLinejoin="round"
        filter={unlocked && useDark ? `url(#${uid}-glow)` : `url(#${uid}-shadow)`}
      />
      <polygon points={HEX_POINTS} fill={`url(#${uid}-shine)`} stroke="none" />
      <polygon
        points="50,10 86,28 86,72 50,90 14,72 14,28"
        fill="none"
        stroke={unlocked ? level.border : "#CBD5E1"}
        strokeOpacity={unlocked ? 0.35 : 0.25}
        strokeWidth="1.2"
      />
    </svg>
  );
}

function LevelLegendItem({ levelId }: { levelId: BadgeLevelId }) {
  const style = LEVEL_STYLES[levelId];
  const Symbol = LEVEL_SYMBOLS[levelId];
  const uid = useId();

  return <LegendTile levelId={levelId} style={style} Symbol={Symbol} uid={uid} />;
}

function LegendTile({ levelId, style, Symbol, uid }: { levelId: BadgeLevelId; style: LevelStyle; Symbol: LucideIcon; uid: string }) {
  return (
    <div className="flex min-w-[4.25rem] shrink-0 flex-col items-center gap-2">
      <div className="relative" style={{ width: 40, height: 46 }}>
        <HexFrame level={style} unlocked size={40} uid={`legend-${levelId}-${uid}`} />
        <span className="absolute inset-0 flex items-center justify-center pb-1">
          <Symbol className="h-4 w-4" strokeWidth={2.2} style={{ color: style.icon }} />
        </span>
      </div>
      <div className="text-center leading-tight">
        <p className="text-[9px] font-black uppercase tracking-[0.06em] text-slate-800">Nivå {LEVEL_ROMAN[levelId]}</p>
        <p className="text-[9px] font-bold uppercase tracking-[0.05em]" style={{ color: style.accent }}>
          {style.label}
        </p>
      </div>
    </div>
  );
}

function TileProgress({ badge, level }: { badge: MemberBadge; level: LevelStyle }) {
  return (
    <div className="mt-2 w-full max-w-[5.25rem]">
      <div className="h-1 overflow-hidden rounded-full bg-white/90 ring-1 ring-slate-200/80">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${badge.progressPct}%`,
            background: badge.unlocked ? MOTUS_GRADIENT : "rgba(148,163,184,0.5)",
          }}
        />
      </div>
      <div className="mt-1 flex justify-between gap-1 text-[8px] font-semibold text-slate-400">
        <span>{formatBadgeValue(badge, badge.current)}</span>
        <span style={{ color: badge.unlocked ? level.accent : undefined }}>{formatBadgeValue(badge, badge.target)}</span>
      </div>
    </div>
  );
}

function BadgeTile({ badge }: { badge: MemberBadge }) {
  const level = LEVEL_STYLES[badge.level];
  const Icon = BADGE_ICONS[badge.icon];
  const uid = useId();
  const isComplete = badge.achievedLevelIndex >= badge.levels.length - 1;
  const hexSize = 76;

  return (
    <article className="flex w-[5.75rem] shrink-0 snap-start flex-col items-center text-center sm:w-[6.25rem]">
      <div className="relative" style={{ width: hexSize, height: Math.round(hexSize * 1.15) }}>
        <HexFrame level={level} unlocked={badge.unlocked} size={hexSize} uid={`badge-${badge.id}-${uid}`} />
        <span className={`absolute inset-0 flex items-center justify-center pb-1 ${badge.unlocked ? "" : "opacity-45 grayscale"}`}>
          <Icon className="h-9 w-9" strokeWidth={2.2} style={{ color: badge.unlocked ? level.icon : "#94A3B8" }} aria-hidden />
        </span>
        {!badge.unlocked ? (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-slate-100 text-slate-400 shadow-md">
            <Lock className="h-3 w-3" strokeWidth={2.4} />
          </span>
        ) : null}
      </div>

      <h3 className="mt-2.5 line-clamp-2 text-[10px] font-black uppercase leading-[1.15] tracking-[0.04em] text-slate-800">
        {badge.title}
      </h3>

      {badge.unlocked && !isComplete ? (
        <p className="mt-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: level.accent }}>
          {badge.levelName}
        </p>
      ) : null}

      {isComplete ? (
        <span className="mt-2 inline-flex items-center gap-0.5 text-[9px] font-bold uppercase" style={{ color: level.accent }}>
          <Check className="h-3 w-3" strokeWidth={3} />
          Maks
        </span>
      ) : (
        <TileProgress badge={badge} level={level} />
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

      <div className="mt-5 rounded-xl bg-slate-50/80 px-3 py-4">
        <div className="flex justify-between gap-2 overflow-x-auto pb-0.5">
          {LEVEL_ORDER.map((levelId) => (
            <LevelLegendItem key={levelId} levelId={levelId} />
          ))}
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

      <div className="mt-4 grid grid-flow-col auto-cols-[5.75rem] gap-x-3 gap-y-5 overflow-x-auto pb-2 sm:auto-cols-[6.25rem] sm:gap-x-4">
        {visibleBadges.map((badge) => (
          <BadgeTile key={badge.id} badge={badge} />
        ))}
      </div>
    </section>
  );
}

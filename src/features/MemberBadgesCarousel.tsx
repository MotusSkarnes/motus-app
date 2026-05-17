import { useId, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Award, CalendarCheck, Check, Crown, Diamond, Dumbbell, Flame, Lock, RefreshCw, Shield, Sparkles, Star, Target, Trophy } from "lucide-react";
import { MOTUS } from "../app/data";
import {
  formatBadgeMetricValue,
  getBadgeNextLevel,
  getBadgeProgressLabel,
  getBadgeUnlockHint,
  type BadgeIconId,
  type BadgeLevelId,
  type MemberBadge,
  type MemberBadgeCategoryId,
  type MemberBadgeCollection,
  type MemberBadgeLevel,
} from "../app/memberBadges";

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
  fill: string;
  darkFace?: boolean;
};

const LEVEL_STYLES: Record<BadgeLevelId, LevelStyle> = {
  bronze: { label: "Bronse", accent: "#B8734D", border: "#C98A5E", icon: "#B8734D", fill: "rgba(184,115,77,0.14)" },
  silver: { label: "Sølv", accent: "#8B9AAB", border: "#A8B4C2", icon: "#7B8A9A", fill: "rgba(139,154,171,0.14)" },
  gold: { label: "Gull", accent: "#D89A17", border: "#E8B23A", icon: "#D89A17", fill: "rgba(216,154,23,0.16)" },
  diamond: { label: "Diamant", accent: MOTUS.turquoise, border: MOTUS.turquoise, icon: MOTUS.turquoise, fill: "rgba(48,227,190,0.14)" },
  legendary: { label: "Legendarisk", accent: MOTUS.pink, border: MOTUS.pink, icon: MOTUS.pink, fill: "rgba(217,18,120,0.14)", darkFace: true },
};

const HEX_POINTS = "50,3 93,26 93,74 50,97 7,74 7,26";

type MemberBadgesCarouselProps = {
  collection: MemberBadgeCollection;
};

type ActiveCategoryId = "all" | MemberBadgeCategoryId;

function HexFrame({ level, unlocked, size = 88, uid, emphasize = false }: { level: LevelStyle; unlocked: boolean; size?: number; uid: string; emphasize?: boolean }) {
  const useDark = unlocked && level.darkFace === true;
  const border = unlocked ? level.border : "#CBD5E1";
  const height = Math.round(size * 1.15);

  return (
    <svg width={size} height={height} viewBox="0 0 100 115" className="block shrink-0" aria-hidden>
      <defs>
        <linearGradient id={`${uid}-face`} x1="0%" y1="0%" x2="0%" y2="100%">
          {useDark ? (
            <>
              <stop offset="0%" stopColor="#334155" />
              <stop offset="50%" stopColor="#141c28" />
              <stop offset="100%" stopColor="#0b1018" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </>
          )}
        </linearGradient>
        <linearGradient id={`${uid}-shine`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
          <stop offset="35%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <radialGradient id={`${uid}-glow-bg`} cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor={unlocked ? level.fill : "rgba(148,163,184,0.08)"} />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id={`${uid}-shadow`} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="5" stdDeviation={emphasize ? 6 : 4} floodColor="rgba(15,23,42,0.16)" />
        </filter>
        {unlocked ? (
          <filter id={`${uid}-accent-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation={emphasize ? 7 : 4} floodColor={level.accent} floodOpacity={useDark ? 0.55 : 0.28} />
          </filter>
        ) : null}
      </defs>
      <polygon points={HEX_POINTS} fill={`url(#${uid}-glow-bg)`} stroke="none" />
      <polygon
        points={HEX_POINTS}
        fill={`url(#${uid}-face)`}
        stroke={border}
        strokeWidth="3"
        strokeLinejoin="round"
        filter={unlocked ? `url(#${uid}-accent-glow) url(#${uid}-shadow)` : `url(#${uid}-shadow)`}
      />
      <polygon points={HEX_POINTS} fill={`url(#${uid}-shine)`} stroke="none" />
      <polygon
        points="50,10 86,28 86,72 50,90 14,72 14,28"
        fill="none"
        stroke={unlocked ? level.border : "#CBD5E1"}
        strokeOpacity={unlocked ? 0.4 : 0.22}
        strokeWidth="1.4"
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
    <div className="flex min-w-[4.5rem] shrink-0 flex-col items-center gap-2">
      <div className="relative" style={{ width: 44, height: 50 }}>
        <HexFrame level={style} unlocked size={44} uid={`legend-${levelId}-${uid}`} />
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

function LevelStep({ level, badge, active }: { level: MemberBadgeLevel; badge: MemberBadge; active: boolean }) {
  const style = LEVEL_STYLES[level.level];

  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center gap-1 ${active ? "opacity-100" : "opacity-80"}`}>
      <span
        className="flex h-7 w-7 items-center justify-center border-2 text-[9px] font-black shadow-sm"
        style={{
          clipPath: "polygon(50% 0%, 90% 18%, 90% 72%, 50% 100%, 10% 72%, 10% 18%)",
          background: level.unlocked ? `linear-gradient(180deg, #fff 0%, ${style.fill} 100%)` : "#f1f5f9",
          borderColor: level.unlocked ? style.border : "#e2e8f0",
          color: level.unlocked ? style.accent : "#94a3b8",
        }}
        title={`${level.levelName}: ${formatBadgeMetricValue(badge.id, level.target)}`}
      >
        {LEVEL_ROMAN[level.level]}
      </span>
      <span className="max-w-full truncate text-center text-[8px] font-bold leading-none" style={{ color: level.unlocked ? style.accent : "#94a3b8" }}>
        {formatBadgeMetricValue(badge.id, level.target)}
      </span>
    </div>
  );
}
function BadgeCard({ badge }: { badge: MemberBadge }) {
  const level = LEVEL_STYLES[badge.level];
  const Icon = BADGE_ICONS[badge.icon];
  const uid = useId();
  const nextLevel = getBadgeNextLevel(badge);
  const isMaxed = !nextLevel;
  const hexSize = 88;
  const hexHeight = Math.round(hexSize * 1.15);

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm ${badge.unlocked ? "bg-white" : "bg-slate-50/90"}`}
      style={{
        borderColor: badge.unlocked ? `${level.border}66` : "rgba(15,23,42,0.08)",
        boxShadow: badge.unlocked ? `0 8px 24px ${level.fill}` : undefined,
      }}
    >
      {badge.unlocked ? (
        <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl" style={{ background: level.fill }} aria-hidden />
      ) : null}

      <div className="relative flex gap-4">
        <div className="relative shrink-0" style={{ width: hexSize, height: hexHeight }}>
          <HexFrame level={level} unlocked={badge.unlocked} size={hexSize} uid={`badge-${badge.id}-${uid}`} emphasize={badge.unlocked} />
          <span className={`absolute inset-0 flex items-center justify-center pb-1 ${badge.unlocked ? "" : "opacity-40 grayscale"}`}>
            <Icon className="h-10 w-10" strokeWidth={2.2} style={{ color: badge.unlocked ? level.icon : "#94A3B8" }} aria-hidden />
          </span>
          {!badge.unlocked ? (
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-white bg-slate-100 text-slate-400 shadow-md">
              <Lock className="h-3.5 w-3.5" strokeWidth={2.4} />
            </span>
          ) : (
            <span
              className="absolute -left-1 top-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase text-white shadow"
              style={{ background: MOTUS_GRADIENT }}
            >
              <Sparkles className="h-2.5 w-2.5" />
              {badge.levelLabel}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{badge.categoryTitle}</span>
            {badge.unlocked ? (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: level.fill, color: level.accent }}>
                {badge.levelName}
              </span>
            ) : (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">Låst</span>
            )}
          </div>
          <h3 className="mt-2 text-base font-black uppercase leading-tight tracking-wide text-slate-900">{badge.title}</h3>
          <p className="mt-1 text-xs leading-snug text-slate-600">{badge.description}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-slate-50/90 p-3" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
        <div className="flex items-start gap-2">
          <Target className="mt-0.5 h-4 w-4 shrink-0" style={{ color: badge.unlocked ? level.accent : "#64748B" }} />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-700">{isMaxed ? "Fullført" : "Neste mål"}</p>
            <p className="mt-0.5 text-xs font-medium leading-snug text-slate-700">{getBadgeUnlockHint(badge)}</p>
          </div>
        </div>

        {!isMaxed ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold text-slate-600">
              <span>Fremdrift</span>
              <span style={{ color: level.accent }}>{getBadgeProgressLabel(badge)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-200/80">
              <div className="h-full rounded-full transition-all" style={{ width: `${badge.progressPct}%`, background: badge.unlocked ? MOTUS_GRADIENT : "rgba(148,163,184,0.5)" }} />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs font-semibold" style={{ color: level.accent }}>
            Alle fem nivåer er låst opp.
          </p>
        )}

        <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Alle nivåer</p>
        <div className="mt-2 flex gap-1">
          {badge.levels.map((lvl) => (
            <LevelStep key={lvl.level} level={lvl} badge={badge} active={lvl.level === badge.level} />
          ))}
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
        <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">Nivåer</p>
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

      <div className="mt-4 space-y-3">
        {visibleBadges.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} />
        ))}
      </div>
    </section>
  );
}

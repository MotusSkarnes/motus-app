import { useMemo, useState } from "react";
import { Award, Lock, Sparkles, Target } from "lucide-react";
import { MOTUS } from "../app/data";
import {
  formatBadgeMetricValue,
  getBadgeNextLevel,
  getBadgeProgressLabel,
  getBadgeUnlockHint,
  type BadgeLevelId,
  type MemberBadge,
  type MemberBadgeCategoryId,
  type MemberBadgeCollection,
  type MemberBadgeLevel,
} from "../app/memberBadges";

const MOTUS_GRADIENT = `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`;

const BADGE_IMAGES: Record<string, string> = {
  sessions: "/badges/02-motte-opp.png",
  streak: "/badges/08-streak-start.png",
  "monday-hero": "/badges/30-mandagshelt.svg",
  "weekend-warrior": "/badges/31-helgekriger.svg",
  lift: "/badges/11-tungt-arbeid.png",
  "month-sessions": "/badges/07-vanebygger.png",
  "training-days": "/badges/13-konsistent.png",
  "goal-percent": "/badges/01-forste-steg.png",
  "may-17-workout": "/badges/21-17-mai.svg",
  "never-two-weeks-without": "/badges/22-aldri-to-uker-uten.svg",
  "back-again": "/badges/23-tilbake-igjen.svg",
  "habit-sticks": "/badges/24-vanen-sitter.svg",
  "before-sunrise": "/badges/25-for-sola.svg",
  "summer-loyal": "/badges/26-sommertrofast.svg",
  "new-start": "/badges/27-ny-start.svg",
  "easter-pump": "/badges/28-paskepump.svg",
  "christmas-pump": "/badges/29-julepump.svg",
};

const LEVEL_ROMAN: Record<BadgeLevelId, string> = {
  bronze: "I",
  silver: "II",
  gold: "III",
  diamond: "IV",
  legendary: "V",
};

type LevelStyle = {
  label: string;
  accent: string;
  border: string;
  fill: string;
};

const LEVEL_STYLES: Record<BadgeLevelId, LevelStyle> = {
  bronze: { label: "Bronse", accent: "#B8734D", border: "#C98A5E", fill: "rgba(184,115,77,0.14)" },
  silver: { label: "Sølv", accent: "#8B9AAB", border: "#A8B4C2", fill: "rgba(139,154,171,0.14)" },
  gold: { label: "Gull", accent: "#D89A17", border: "#E8B23A", fill: "rgba(216,154,23,0.16)" },
  diamond: { label: "Diamant", accent: MOTUS.turquoise, border: MOTUS.turquoise, fill: "rgba(48,227,190,0.14)" },
  legendary: { label: "Legendarisk", accent: MOTUS.pink, border: MOTUS.pink, fill: "rgba(217,18,120,0.14)" },
};

type MemberBadgesCarouselProps = {
  collection: MemberBadgeCollection;
};

type ActiveCategoryId = "all" | MemberBadgeCategoryId;

function LevelStep({ level, badge, active }: { level: MemberBadgeLevel; badge: MemberBadge; active: boolean }) {
  const style = LEVEL_STYLES[level.level];

  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center gap-1 ${active ? "opacity-100" : "opacity-80"}`}>
      <span
        className="flex h-6 w-6 items-center justify-center border-2 text-[8px] font-black shadow-sm"
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
      <span className="max-w-full truncate text-center text-[7px] font-bold leading-none" style={{ color: level.unlocked ? style.accent : "#94a3b8" }}>
        {formatBadgeMetricValue(badge.id, level.target)}
      </span>
    </div>
  );
}
function BadgeCard({ badge }: { badge: MemberBadge }) {
  const level = LEVEL_STYLES[badge.level];
  const nextLevel = getBadgeNextLevel(badge);
  const isMaxed = !nextLevel;
  const badgeImage = BADGE_IMAGES[badge.id] ?? "/badges/01-forste-steg.png";

  return (
    <article
      className={`relative w-[17rem] shrink-0 snap-start overflow-hidden rounded-2xl border p-3 shadow-sm sm:w-[18.5rem] ${badge.unlocked ? "bg-white" : "bg-slate-50/90"}`}
      style={{
        borderColor: badge.unlocked ? `${level.border}66` : "rgba(15,23,42,0.08)",
        boxShadow: badge.unlocked ? `0 8px 24px ${level.fill}` : undefined,
      }}
    >
      {badge.unlocked ? (
        <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl" style={{ background: level.fill }} aria-hidden />
      ) : null}

      <div className="relative flex gap-3">
        <div className="relative flex h-[5.4rem] w-[5.4rem] shrink-0 items-center justify-center">
          <img
            src={badgeImage}
            alt=""
            className={`h-full w-full object-contain drop-shadow-sm ${badge.unlocked ? "" : "opacity-45 grayscale"}`}
            loading="lazy"
          />
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
          <h3 className="mt-1.5 text-sm font-black uppercase leading-tight tracking-wide text-slate-900">{badge.title}</h3>
          <p className="mt-1 text-xs leading-snug text-slate-600">{badge.description}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border bg-slate-50/90 p-2.5" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
        <div className="flex items-start gap-2">
          <Target className="mt-0.5 h-4 w-4 shrink-0" style={{ color: badge.unlocked ? level.accent : "#64748B" }} />
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-wide text-slate-700">{isMaxed ? "Fullført" : "Neste mål"}</p>
            <p className="mt-0.5 text-xs font-medium leading-snug text-slate-700">{getBadgeUnlockHint(badge)}</p>
          </div>
        </div>

        {!isMaxed ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-bold text-slate-600">
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

        <div className="mt-2.5 flex gap-1">
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
    <section className="min-w-0 overflow-hidden rounded-2xl border bg-white p-3 shadow-sm sm:p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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

      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
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

      <div className="-mx-1 mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-2">
        {visibleBadges.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} />
        ))}
      </div>
    </section>
  );
}

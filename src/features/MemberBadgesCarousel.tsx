import { useMemo, useState } from "react";
import { Award, Lock, Share2, Sparkles, Target } from "lucide-react";
import { MOTUS } from "../app/data";
import { motusShareStatusMessage, shareBadgeCard } from "../app/motusShareCard";
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
  sessions: "/badges/02-oktjeger.png",
  "workout-club": "/badges/32-100-klubben.svg",
  streak: "/badges/08-streak.png",
  "monday-hero": "/badges/30-mandagshelt.svg",
  "weekend-warrior": "/badges/31-helgekriger.svg",
  lift: "/badges/11-tungt-arbeid.png",
  "month-sessions": "/badges/07-vanebygger.png",
  "training-days": "/badges/13-konsistent.png",
  "goal-percent": "/badges/01-forste-steg.png",
  pulsmaskin: "/badges/33-pulsmaskin.png",
  "may-17-workout": "/badges/21-17-mai.svg",
  "never-two-weeks-without": "/badges/22-aldri-to-uker-uten.svg",
  "back-again": "/badges/23-tilbake-igjen.svg",
  "habit-sticks": "/badges/24-vanen-sitter.svg",
  "before-sunrise": "/badges/25-for-sola.svg",
  "evening-trainer": "/badges/04-kveldsskiftet.png",
  "summer-loyal": "/badges/26-sommertrofast.svg",
  "new-start": "/badges/27-ny-start.svg",
  "easter-pump": "/badges/28-paskepump.svg",
  "christmas-pump": "/badges/29-julepump.svg",
};

/** Større badge-grafikk uten innramming/padding (f.eks. Pulsmaskin). */
const LARGE_BADGE_IDS = new Set<string>(["pulsmaskin"]);

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
  memberDisplayName: string;
  shareLogoSrc: string;
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
function BadgeCard({
  badge,
  memberDisplayName,
  shareLogoSrc,
  onShareStatus,
}: {
  badge: MemberBadge;
  memberDisplayName: string;
  shareLogoSrc: string;
  onShareStatus: (message: string | null) => void;
}) {
  const [isSharing, setIsSharing] = useState(false);
  const level = LEVEL_STYLES[badge.level];
  const nextLevel = getBadgeNextLevel(badge);
  const isMaxed = !nextLevel;
  const badgeImage = BADGE_IMAGES[badge.id] ?? "/badges/01-forste-steg.png";
  const isLargeBadge = LARGE_BADGE_IDS.has(badge.id);

  async function shareBadge() {
    if (!badge.unlocked || isSharing) return;
    setIsSharing(true);
    onShareStatus(null);
    try {
      const outcome = await shareBadgeCard({
        logoSrc: shareLogoSrc,
        memberDisplayName,
        badgeImageSrc: badgeImage,
        badgeTitle: badge.title,
        badgeDescription: badge.description,
        levelName: badge.levelName,
        categoryTitle: badge.categoryTitle,
        accentColor: level.accent,
      });
      onShareStatus(motusShareStatusMessage(outcome));
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <article
      className={`relative shrink-0 snap-start overflow-hidden rounded-2xl p-3 shadow-sm ${
        isLargeBadge ? "w-[19.5rem] sm:w-[21rem]" : "w-[17rem] sm:w-[18.5rem]"
      } ${isLargeBadge ? "border-0 bg-white" : `border ${badge.unlocked ? "bg-white" : "bg-slate-50/90"}`}`}
      style={
        isLargeBadge
          ? { boxShadow: badge.unlocked ? `0 10px 28px ${level.fill}` : "0 4px 16px rgba(15,23,42,0.06)" }
          : {
              borderColor: badge.unlocked ? `${level.border}66` : "rgba(15,23,42,0.08)",
              boxShadow: badge.unlocked ? `0 8px 24px ${level.fill}` : undefined,
            }
      }
    >
      {badge.unlocked ? (
        <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl" style={{ background: level.fill }} aria-hidden />
      ) : null}

      <div className={`relative flex gap-3 ${isLargeBadge ? "flex-col items-center text-center" : ""}`}>
        <div
          className={`relative flex shrink-0 items-center justify-center ${
            isLargeBadge ? "h-[10.5rem] w-full max-w-[11.5rem]" : "h-[5.4rem] w-[5.4rem]"
          }`}
        >
          <img
            src={badgeImage}
            alt=""
            className={`h-full w-full object-contain drop-shadow-md ${isLargeBadge ? "p-0" : "p-1.5 drop-shadow-sm"} ${
              badge.unlocked ? "" : "opacity-45 grayscale"
            }`}
            loading="lazy"
          />
          {!badge.unlocked ? (
            <span
              className={`absolute flex items-center justify-center rounded-full border border-white bg-slate-100 text-slate-400 shadow-md ${
                isLargeBadge ? "-bottom-2 -right-2 h-9 w-9" : "-bottom-1 -right-1 h-7 w-7"
              }`}
            >
              <Lock className={isLargeBadge ? "h-4 w-4" : "h-3.5 w-3.5"} strokeWidth={2.4} />
            </span>
          ) : (
            <span
              className={`absolute inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase text-white shadow ${
                isLargeBadge ? "right-0 top-2" : "-left-1 top-1"
              }`}
              style={{ background: MOTUS_GRADIENT }}
            >
              <Sparkles className="h-2.5 w-2.5" />
              {badge.levelLabel}
            </span>
          )}
        </div>

        <div className={`min-w-0 ${isLargeBadge ? "w-full" : "flex-1"}`}>
          <div className={`flex flex-wrap items-center gap-2 ${isLargeBadge ? "justify-center" : ""}`}>
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
        {badge.unlocked ? (
          <button
            type="button"
            onClick={() => void shareBadge()}
            disabled={isSharing}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50/80 disabled:opacity-60"
            title="Del på Facebook eller andre apper"
          >
            <Share2 className="h-3.5 w-3.5 shrink-0 text-teal-700" aria-hidden />
            {isSharing ? "Lager skrytekort…" : "Del badgen"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function MemberBadgesCarousel({ collection, memberDisplayName, shareLogoSrc }: MemberBadgesCarouselProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<ActiveCategoryId>("all");
  const [badgeShareStatus, setBadgeShareStatus] = useState<string | null>(null);

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
          <h2 className="text-sm font-semibold text-slate-900">Badges</h2>
          <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/90 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
            Det finnes flere skjulte badges som ikke vises før du oppnår de, oppdag de ved å bruke appen jevnlig.
          </p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="text-xs text-slate-500">
              {collection.totalUnlockedLevels} av {collection.totalLevels} nivåer låst opp
            </p>
            <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-white">{overallPct}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
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

      {badgeShareStatus ? (
        <p className="mt-3 rounded-xl border border-teal-200/80 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-950">{badgeShareStatus}</p>
      ) : null}

      <div className="-mx-1 mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-2">
        {visibleBadges.map((badge) => (
          <BadgeCard
            key={badge.id}
            badge={badge}
            memberDisplayName={memberDisplayName}
            shareLogoSrc={shareLogoSrc}
            onShareStatus={setBadgeShareStatus}
          />
        ))}
      </div>
    </section>
  );
}

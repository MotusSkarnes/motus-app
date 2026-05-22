import { useMemo, useState } from "react";
import { Award, Lock, Share2, Sparkles, Target } from "lucide-react";
import { memberBadgeImageSrc } from "../app/badgeAssets";
import { BADGE_CAROUSEL_TRACK_SNAP_CLASS, BADGE_CAROUSEL_WRAPPER_CLASS, BADGE_CATEGORY_SCROLL_CLASS } from "../app/badgeImagePresentation";
import { BadgeCarouselScroll } from "./BadgeCarouselScroll";
import { BadgeImage } from "./BadgeImage";
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
  const badgeImage = memberBadgeImageSrc(badge);
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
      className={`motus-badge-card relative z-10 flex w-[15.5rem] shrink-0 snap-start flex-col overflow-visible rounded-2xl border p-2.5 shadow-sm sm:w-[16.5rem] ${badge.unlocked ? "bg-white" : "bg-slate-50/90"}`}
      style={{
        borderColor: badge.unlocked ? `${level.border}66` : "rgba(15,23,42,0.08)",
        boxShadow: badge.unlocked ? `0 6px 18px ${level.fill}` : undefined,
      }}
    >
      <div className="flex items-start gap-2.5">
        <div className="motus-badge-card-art relative shrink-0 overflow-visible">
          <BadgeImage src={badgeImage} size="cardCompact" dimmed={!badge.unlocked} alt={badge.title} />
          {!badge.unlocked ? (
            <span className="absolute bottom-0.5 right-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-slate-100 text-slate-400 shadow-md">
              <Lock className="h-3 w-3" strokeWidth={2.4} />
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex flex-1 flex-col justify-center gap-1 py-0.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">{badge.categoryTitle}</span>
            {badge.unlocked ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[7px] font-black uppercase text-white shadow"
                style={{ background: MOTUS_GRADIENT }}
              >
                <Sparkles className="h-2 w-2 shrink-0" />
                <span className="truncate">{badge.levelLabel}</span>
              </span>
            ) : (
              <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[8px] font-bold uppercase text-slate-500">Låst</span>
            )}
          </div>
          <h3 className="break-words text-xs font-black uppercase leading-tight tracking-wide text-slate-900">{badge.title}</h3>
          <p className="line-clamp-3 text-[10px] leading-snug text-slate-600">{badge.description}</p>
        </div>
      </div>

      <div className="mt-2.5 w-full rounded-lg border bg-slate-50/90 p-2" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
        <div className="flex items-start gap-1.5">
          <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: badge.unlocked ? level.accent : "#64748B" }} />
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-wide text-slate-700">{isMaxed ? "Fullført" : "Neste mål"}</p>
            <p className="mt-0.5 text-[10px] font-medium leading-snug text-slate-700">{getBadgeUnlockHint(badge)}</p>
          </div>
        </div>

        {!isMaxed ? (
          <div className="mt-2">
            <div className="mb-0.5 flex items-center justify-between gap-1 text-[8px] font-bold text-slate-600">
              <span>Fremdrift</span>
              <span style={{ color: level.accent }}>{getBadgeProgressLabel(badge)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-200/80">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${badge.progressPct}%`, background: badge.unlocked ? MOTUS_GRADIENT : "rgba(148,163,184,0.5)" }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[10px] font-semibold" style={{ color: level.accent }}>
            Alle fem nivåer er låst opp.
          </p>
        )}

        <div className="mt-2 flex gap-0.5">
          {badge.levels.map((lvl) => (
            <LevelStep key={lvl.level} level={lvl} badge={badge} active={lvl.level === badge.level} />
          ))}
        </div>

        {badge.unlocked ? (
          <button
            type="button"
            onClick={() => void shareBadge()}
            disabled={isSharing}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50/80 disabled:opacity-60"
            title="Del på Facebook eller andre apper"
          >
            <Share2 className="h-3 w-3 shrink-0 text-teal-700" aria-hidden />
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
    <section className="motus-badges-section min-w-0 overflow-visible rounded-2xl border bg-white p-3 shadow-sm sm:p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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

      <div className={`-mx-1 mt-3 ${BADGE_CATEGORY_SCROLL_CLASS}`}>
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

      <BadgeCarouselScroll className={BADGE_CAROUSEL_WRAPPER_CLASS} trackClassName={BADGE_CAROUSEL_TRACK_SNAP_CLASS}>
        {visibleBadges.map((badge) => (
          <BadgeCard
            key={badge.id}
            badge={badge}
            memberDisplayName={memberDisplayName}
            shareLogoSrc={shareLogoSrc}
            onShareStatus={setBadgeShareStatus}
          />
        ))}
      </BadgeCarouselScroll>
    </section>
  );
}

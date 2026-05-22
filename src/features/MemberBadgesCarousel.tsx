import { useEffect, useMemo, useState } from "react";
import { Award, Lock, Share2, Sparkles, Target } from "lucide-react";
import { memberBadgeImageSrc } from "../app/badgeAssets";
import {
  BADGE_CAROUSEL_SCROLL_CLASS,
  BADGE_IMAGE_HERO_CLASS,
  BADGE_IMAGE_HERO_WRAPPER_CLASS,
  BADGE_IMAGE_THUMB_CLASS,
  BADGE_IMAGE_THUMB_WRAPPER_CLASS,
} from "../app/badgeImagePresentation";
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

function pickDefaultFeaturedBadge(badges: MemberBadge[]): MemberBadge | null {
  if (!badges.length) return null;
  const unlocked = badges.filter((badge) => badge.unlocked);
  if (unlocked.length > 0) {
    return [...unlocked].sort((a, b) => b.achievedLevelIndex - a.achievedLevelIndex || b.progressPct - a.progressPct)[0] ?? null;
  }
  return [...badges].sort((a, b) => b.progressPct - a.progressPct)[0] ?? badges[0] ?? null;
}

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

function FeaturedBadgeHero({
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
    <div
      className="mt-4 overflow-visible rounded-2xl border bg-gradient-to-b from-slate-50/90 to-white p-4 sm:p-5"
      style={{ borderColor: badge.unlocked ? `${level.border}55` : "rgba(15,23,42,0.08)" }}
    >
      <div className={BADGE_IMAGE_HERO_WRAPPER_CLASS}>
        <img
          src={badgeImage}
          alt=""
          className={`${BADGE_IMAGE_HERO_CLASS} ${badge.unlocked ? "" : "opacity-50 grayscale"}`}
          loading="eager"
          decoding="async"
        />
        {!badge.unlocked ? (
          <span className="absolute flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-slate-400 shadow-lg">
            <Lock className="h-5 w-5" strokeWidth={2.4} aria-hidden />
          </span>
        ) : null}
      </div>

      <div className="mt-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">{badge.categoryTitle}</span>
          {badge.unlocked ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase text-white shadow-sm"
              style={{ background: MOTUS_GRADIENT }}
            >
              <Sparkles className="h-3 w-3" aria-hidden />
              {badge.levelName}
            </span>
          ) : (
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">Låst</span>
          )}
        </div>
        <h3 className="mt-2 text-lg font-black uppercase tracking-wide text-slate-900">{badge.title}</h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">{badge.description}</p>
      </div>

      <div className="mt-4 rounded-xl border bg-white/80 p-3" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
        <div className="flex items-start gap-2">
          <Target className="mt-0.5 h-4 w-4 shrink-0" style={{ color: badge.unlocked ? level.accent : "#64748B" }} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-wide text-slate-700">{isMaxed ? "Fullført" : "Neste mål"}</p>
            <p className="mt-0.5 text-sm font-medium leading-snug text-slate-700">{getBadgeUnlockHint(badge)}</p>
          </div>
        </div>
        {!isMaxed ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold text-slate-600">
              <span>Fremdrift</span>
              <span style={{ color: level.accent }}>{getBadgeProgressLabel(badge)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/80">
              <div className="h-full rounded-full transition-all" style={{ width: `${badge.progressPct}%`, background: badge.unlocked ? MOTUS_GRADIENT : "rgba(148,163,184,0.5)" }} />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-center text-sm font-semibold" style={{ color: level.accent }}>
            Alle fem nivåer er låst opp.
          </p>
        )}
        <div className="mt-3 flex gap-1">
          {badge.levels.map((lvl) => (
            <LevelStep key={lvl.level} level={lvl} badge={badge} active={lvl.level === badge.level} />
          ))}
        </div>
        {badge.unlocked ? (
          <button
            type="button"
            onClick={() => void shareBadge()}
            disabled={isSharing}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50/80 disabled:opacity-60"
          >
            <Share2 className="h-4 w-4 shrink-0 text-teal-700" aria-hidden />
            {isSharing ? "Lager skrytekort…" : "Del badgen"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function BadgeListCard({
  badge,
  isFeatured,
  onSelect,
}: {
  badge: MemberBadge;
  isFeatured: boolean;
  onSelect: () => void;
}) {
  const level = LEVEL_STYLES[badge.level];
  const badgeImage = memberBadgeImageSrc(badge);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-[10.5rem] shrink-0 snap-start rounded-xl border p-2.5 text-left transition sm:w-[11.5rem] ${
        isFeatured ? "ring-2 ring-teal-300 ring-offset-1" : "hover:border-teal-200 hover:bg-teal-50/30"
      } ${badge.unlocked ? "bg-white" : "bg-slate-50/90"}`}
      style={{ borderColor: isFeatured ? MOTUS.turquoise : badge.unlocked ? `${level.border}44` : "rgba(15,23,42,0.08)" }}
      aria-pressed={isFeatured}
      aria-label={`Vis ${badge.title} stort`}
    >
      <div className="flex items-center gap-2">
        <div className={BADGE_IMAGE_THUMB_WRAPPER_CLASS}>
          <img
            src={badgeImage}
            alt=""
            className={`${BADGE_IMAGE_THUMB_CLASS} ${badge.unlocked ? "" : "opacity-45 grayscale"}`}
            loading="lazy"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold text-slate-500">{badge.categoryTitle}</p>
          <p className="truncate text-xs font-bold text-slate-900">{badge.title}</p>
          <p className="mt-0.5 text-[10px] font-medium" style={{ color: badge.unlocked ? level.accent : "#94a3b8" }}>
            {badge.unlocked ? badge.levelName : "Låst"}
          </p>
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${badge.progressPct}%`, background: badge.unlocked ? MOTUS_GRADIENT : "rgba(148,163,184,0.4)" }} />
      </div>
    </button>
  );
}

export function MemberBadgesCarousel({ collection, memberDisplayName, shareLogoSrc }: MemberBadgesCarouselProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<ActiveCategoryId>("all");
  const [featuredBadgeId, setFeaturedBadgeId] = useState<string | null>(null);
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

  const featuredBadge = useMemo(() => {
    if (!visibleBadges.length) return null;
    const selected = featuredBadgeId ? visibleBadges.find((badge) => badge.id === featuredBadgeId) : null;
    return selected ?? pickDefaultFeaturedBadge(visibleBadges);
  }, [featuredBadgeId, visibleBadges]);

  useEffect(() => {
    const defaultBadge = pickDefaultFeaturedBadge(visibleBadges);
    setFeaturedBadgeId(defaultBadge?.id ?? null);
  }, [activeCategoryId]);

  if (!collection.totalCount || !featuredBadge) return null;

  const overallPct = collection.totalLevels > 0 ? Math.round((collection.totalUnlockedLevels / collection.totalLevels) * 100) : 0;

  return (
    <section className="min-w-0 overflow-visible rounded-2xl border bg-white p-3 shadow-sm sm:p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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

      <FeaturedBadgeHero
        badge={featuredBadge}
        memberDisplayName={memberDisplayName}
        shareLogoSrc={shareLogoSrc}
        onShareStatus={setBadgeShareStatus}
      />

      <p className="mt-4 text-center text-[11px] font-medium text-slate-500">Trykk en badge under for å vise den stort</p>

      <div className={`-mx-1 mt-2 flex gap-2 px-1 pb-1 ${BADGE_CAROUSEL_SCROLL_CLASS}`}>
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

      <div className={`-mx-1 mt-3 flex snap-x snap-mandatory gap-2 px-1 pb-2 pt-1 ${BADGE_CAROUSEL_SCROLL_CLASS}`}>
        {visibleBadges.map((badge) => (
          <BadgeListCard
            key={badge.id}
            badge={badge}
            isFeatured={badge.id === featuredBadge.id}
            onSelect={() => setFeaturedBadgeId(badge.id)}
          />
        ))}
      </div>
    </section>
  );
}

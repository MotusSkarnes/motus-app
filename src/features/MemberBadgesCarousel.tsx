import { useEffect, useMemo, useState } from "react";
import { Award, Lock, Share2, Sparkles, Target, X } from "lucide-react";
import { memberBadgeImageSrc } from "../app/badgeAssets";
import { BADGE_CAROUSEL_TRACK_SNAP_CLASS, BADGE_CAROUSEL_WRAPPER_CLASS, BADGE_CATEGORY_SCROLL_CLASS } from "../app/badgeImagePresentation";
import { BadgeCarouselScroll } from "./BadgeCarouselScroll";
import { BadgeImage } from "./BadgeImage";
import { MOTUS } from "../app/data";
import { GradientButton, MotusSectionIcon } from "../app/ui";
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

function BadgeTile({ badge, onSelect }: { badge: MemberBadge; onSelect: () => void }) {
  const level = LEVEL_STYLES[badge.level];
  const badgeImage = memberBadgeImageSrc(badge);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`motus-badge-tile shrink-0 snap-start ${badge.unlocked ? "motus-badge-tile--unlocked" : "motus-badge-tile--locked"}`}
      style={badge.unlocked ? { boxShadow: `0 8px 20px ${level.fill}` } : undefined}
      aria-label={`${badge.title}${badge.unlocked ? `, ${badge.levelLabel}` : ", låst"}`}
    >
      <span className="motus-badge-tile-art">
        <BadgeImage src={badgeImage} size="tile" dimmed={!badge.unlocked} alt="" />
        {!badge.unlocked ? (
          <span className="motus-badge-tile-lock" aria-hidden>
            <Lock className="h-3.5 w-3.5" strokeWidth={2.4} />
          </span>
        ) : null}
      </span>
      <span className={`motus-badge-tile-label ${badge.unlocked ? "" : "motus-badge-tile-label--locked"}`}>{badge.title}</span>
    </button>
  );
}

function BadgeDetailView({
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
    <div className="motus-badge-detail motus-badge-detail--modal">
      <div className="flex justify-center overflow-visible">
        <BadgeImage src={badgeImage} size="detail" dimmed={!badge.unlocked} alt={badge.title} loading="eager" />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">{badge.categoryTitle}</span>
        {badge.unlocked ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase text-white shadow"
            style={{ background: MOTUS_GRADIENT }}
          >
            <Sparkles className="h-2.5 w-2.5 shrink-0" />
            {badge.levelLabel}
          </span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">Låst</span>
        )}
      </div>

      <h3 className="mt-2 text-center text-base font-black uppercase tracking-wide text-slate-900">{badge.title}</h3>
      <p className="motus-badge-detail-description mt-1.5 text-center text-xs leading-relaxed text-slate-600">{badge.description}</p>

      <div className="mt-3 w-full rounded-xl border bg-slate-50/90 p-2.5" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
        <div className="flex items-start gap-2">
          <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: badge.unlocked ? level.accent : "#64748B" }} />
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-wide text-slate-700">{isMaxed ? "Fullført" : "Neste mål"}</p>
            <p className="mt-0.5 text-xs font-medium leading-snug text-slate-700">{getBadgeUnlockHint(badge)}</p>
          </div>
        </div>

        {!isMaxed ? (
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between gap-1 text-[9px] font-bold text-slate-600">
              <span>Fremdrift</span>
              <span style={{ color: level.accent }}>{getBadgeProgressLabel(badge)}</span>
            </div>
            <div className="motus-progress-track h-1.5 rounded-full ring-1 ring-slate-200/80">
              <div
                className="motus-progress-fill h-full rounded-full transition-all"
                style={{ width: `${badge.progressPct}%`, background: badge.unlocked ? MOTUS_GRADIENT : "rgba(148,163,184,0.5)" }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs font-semibold" style={{ color: level.accent }}>
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
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50/80 disabled:opacity-60"
            title="Del på Facebook eller andre apper"
          >
            <Share2 className="h-3.5 w-3.5 shrink-0 text-teal-700" aria-hidden />
            {isSharing ? "Lager skrytekort…" : "Del badgen"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function BadgeDetailModal({
  badge,
  memberDisplayName,
  shareLogoSrc,
  onClose,
  onShareStatus,
}: {
  badge: MemberBadge;
  memberDisplayName: string;
  shareLogoSrc: string;
  onClose: () => void;
  onShareStatus: (message: string | null) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="motus-modal-insets motus-badge-detail-modal fixed inset-0 z-[10018] flex items-center justify-center overflow-hidden bg-slate-900/45 p-3 sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="motus-pop-in relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border bg-white shadow-xl"
        style={{ borderColor: "rgba(15,23,42,0.1)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="motus-pressable absolute right-2.5 top-2.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-500 shadow-sm transition hover:text-slate-800"
          aria-label="Lukk"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 pt-10 sm:px-5">
          <h2 id="badge-detail-title" className="sr-only">
            {badge.title}
          </h2>
          <BadgeDetailView
            badge={badge}
            memberDisplayName={memberDisplayName}
            shareLogoSrc={shareLogoSrc}
            onShareStatus={onShareStatus}
          />
        </div>
        <div className="shrink-0 border-t border-slate-100 px-4 py-3 sm:px-5">
          <GradientButton onClick={onClose} className="w-full min-h-10 text-sm font-semibold">
            Lukk
          </GradientButton>
        </div>
      </div>
    </div>
  );
}

export function MemberBadgesCarousel({ collection, memberDisplayName, shareLogoSrc }: MemberBadgesCarouselProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<ActiveCategoryId>("all");
  const [badgeShareStatus, setBadgeShareStatus] = useState<string | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<MemberBadge | null>(null);

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
    <>
      <section className="motus-badges-section motus-card min-w-0 overflow-visible p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <MotusSectionIcon>
            <Award className="h-4 w-4" />
          </MotusSectionIcon>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900">Badges</h2>
            <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/90 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
              Det finnes flere skjulte badges som ikke vises før du oppnår de, oppdag de ved å bruke appen jevnlig.
            </p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="text-xs text-slate-500">
                {collection.totalUnlockedLevels} av {collection.totalLevels} nivåer låst opp
              </p>
              <span className="rounded-full bg-[#F3F5F7] px-2.5 py-1 text-[10px] font-bold text-slate-900">{overallPct}%</span>
            </div>
            <div className="motus-progress-track mt-2 h-1.5 rounded-full">
              <div className="motus-progress-fill h-full rounded-full" style={{ width: `${overallPct}%`, background: MOTUS_GRADIENT }} />
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
                className={`motus-pressable motus-surface-chip shrink-0 px-3 py-2 ${active ? "motus-surface-chip--active" : ""}`}
              >
                {item.title} <span className={active ? "opacity-75" : "text-slate-400"}>{item.count}</span>
              </button>
            );
          })}
        </div>

        {badgeShareStatus ? (
          <p className="mt-3 rounded-xl border border-teal-200/80 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-950">{badgeShareStatus}</p>
        ) : null}

        <BadgeCarouselScroll className={BADGE_CAROUSEL_WRAPPER_CLASS} trackClassName={BADGE_CAROUSEL_TRACK_SNAP_CLASS}>
          {visibleBadges.map((badge) => (
            <BadgeTile key={badge.id} badge={badge} onSelect={() => setSelectedBadge(badge)} />
          ))}
        </BadgeCarouselScroll>
      </section>

      {selectedBadge ? (
        <BadgeDetailModal
          badge={selectedBadge}
          memberDisplayName={memberDisplayName}
          shareLogoSrc={shareLogoSrc}
          onClose={() => setSelectedBadge(null)}
          onShareStatus={setBadgeShareStatus}
        />
      ) : null}
    </>
  );
}

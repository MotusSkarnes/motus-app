import { useRef } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Lock,
  PlayCircle,
  RefreshCw,
  Trophy,
  Zap,
} from "lucide-react";
import { MOTUS } from "../app/data";
import type { BadgeIconId, MemberBadge, MemberBadgeCollection } from "../app/memberBadges";

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

type MemberBadgesCarouselProps = {
  collection: MemberBadgeCollection;
};

function AchievementBadge({ badge }: { badge: MemberBadge }) {
  const Icon = BADGE_ICONS[badge.icon];
  const progressPct = badge.target > 0 ? Math.min(100, Math.round((badge.current / badge.target) * 100)) : 0;
  const accent = badge.kind === "monthly" ? MOTUS.pink : MOTUS.turquoise;
  const statusLabel = badge.unlocked ? "Fullført" : `${Math.min(badge.current, badge.target)}/${badge.target}`;

  return (
    <article
      className={`flex h-32 w-44 shrink-0 snap-start flex-col rounded-xl border p-3 shadow-sm transition sm:w-48 ${
        badge.unlocked ? "bg-white" : "bg-slate-50/80"
      }`}
      style={{ borderColor: badge.unlocked ? "rgba(48,227,190,0.28)" : "rgba(15,23,42,0.08)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
            badge.unlocked ? "bg-white" : "bg-white text-slate-400"
          }`}
          style={{
            borderColor: badge.unlocked ? "rgba(48,227,190,0.28)" : "rgba(15,23,42,0.08)",
            color: badge.unlocked ? accent : undefined,
          }}
        >
          <Icon className="h-5 w-5" strokeWidth={badge.unlocked ? 2.2 : 1.8} aria-hidden />
        </span>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
            badge.unlocked ? "text-white" : "bg-white text-slate-500"
          }`}
          style={badge.unlocked ? { background: accent } : { border: "1px solid rgba(15,23,42,0.08)" }}
        >
          {badge.unlocked ? <Check className="h-3 w-3" strokeWidth={3} /> : <Lock className="h-3 w-3" />}
          {statusLabel}
        </span>
      </div>

      <h3
        className={`mt-3 line-clamp-2 min-h-[2rem] text-left text-sm font-semibold leading-tight ${
          badge.unlocked ? "text-slate-900" : "text-slate-600"
        }`}
      >
        {badge.title}
      </h3>

      <div className="mt-auto">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${badge.unlocked ? 100 : progressPct}%`, background: badge.unlocked ? accent : MOTUS_GRADIENT }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] font-semibold text-slate-500">
          <span>{badge.kind === "monthly" ? "Måned" : "Fast"}</span>
          <span>{badge.unlocked ? "Låst opp" : `${progressPct}%`}</span>
        </div>
      </div>
    </article>
  );
}

function BadgeRow({
  title,
  hint,
  badges,
  scrollRef,
  onScroll,
}: {
  title: string;
  hint: string;
  badges: MemberBadge[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (direction: "left" | "right") => void;
}) {
  if (!badges.length) return null;

  const unlocked = badges.filter((badge) => badge.unlocked).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-slate-800">{title}</h3>
          <p className="text-[11px] text-slate-500">
            {unlocked}/{badges.length} · {hint}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onScroll("left")}
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
            aria-label={`Forrige ${title}`}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onScroll("right")}
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
            aria-label={`Neste ${title}`}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="-mx-0.5 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-0.5 pb-1 pt-0.5"
      >
        {badges.map((badge) => (
          <AchievementBadge key={badge.id} badge={badge} />
        ))}
      </div>
    </div>
  );
}

export function MemberBadgesCarousel({ collection }: MemberBadgesCarouselProps) {
  const permanentRef = useRef<HTMLDivElement | null>(null);
  const monthlyRef = useRef<HTMLDivElement | null>(null);

  const permanentUnlocked = collection.permanent.filter((badge) => badge.unlocked).length;
  const monthlyUnlocked = collection.monthly.filter((badge) => badge.unlocked).length;
  const totalCount = collection.permanent.length + collection.monthly.length;
  const totalUnlocked = permanentUnlocked + monthlyUnlocked;
  const overallPct = totalCount > 0 ? Math.round((totalUnlocked / totalCount) * 100) : 0;

  function scrollRow(ref: React.RefObject<HTMLDivElement | null>, direction: "left" | "right") {
    const node = ref.current;
    if (!node) return;
    const amount = Math.max(180, Math.round(node.clientWidth * 0.75));
    node.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  }

  if (!totalCount) return null;

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
          <h2 className="text-sm font-semibold text-slate-900">Utmerkelser</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {totalUnlocked} av {totalCount} fullført
            {collection.allPermanentUnlocked ? " · alle faste er dine" : ""}
            {collection.allMonthlyUnlocked ? " · måneden er i mål" : ""}
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${overallPct}%`, background: MOTUS_GRADIENT }} />
          </div>
        </div>
      </div>

      {collection.monthly.length > 0 ? (
        <p className="mt-3 text-[11px] leading-snug text-slate-500">
          <span className="font-medium text-slate-700">Månedens utfordringer</span> ({collection.monthLabel}) byttes 1. neste
          måned. Faste utmerkelser beholder du.
        </p>
      ) : null}

      <div className="mt-4 space-y-5">
        <BadgeRow
          title="Faste"
          hint="beholdes alltid"
          badges={collection.permanent}
          scrollRef={permanentRef}
          onScroll={(direction) => scrollRow(permanentRef, direction)}
        />
        {collection.monthly.length > 0 ? (
          <BadgeRow
            title="Denne måneden"
            hint="roterende utfordringer"
            badges={collection.monthly}
            scrollRef={monthlyRef}
            onScroll={(direction) => scrollRow(monthlyRef, direction)}
          />
        ) : null}
      </div>
    </section>
  );
}

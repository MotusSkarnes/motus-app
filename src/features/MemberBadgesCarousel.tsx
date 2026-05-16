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
const MEDAL_SIZE = 76;
const RING_RADIUS = 34;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

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

function ringStroke(badge: MemberBadge): string {
  if (badge.unlocked) {
    return badge.kind === "monthly" ? MOTUS.pink : MOTUS.turquoise;
  }
  return "#cbd5e1";
}

function MedalBadge({ badge }: { badge: MemberBadge }) {
  const Icon = BADGE_ICONS[badge.icon];
  const progressPct = badge.target > 0 ? Math.min(1, badge.current / badge.target) : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progressPct);
  const accent = badge.kind === "monthly" ? MOTUS.pink : MOTUS.turquoise;

  return (
    <article className="flex w-[5.75rem] shrink-0 snap-start flex-col items-center sm:w-24">
      <div className="relative" style={{ width: MEDAL_SIZE, height: MEDAL_SIZE }}>
        <svg
          width={MEDAL_SIZE}
          height={MEDAL_SIZE}
          viewBox={`0 0 ${MEDAL_SIZE} ${MEDAL_SIZE}`}
          className="absolute inset-0 -rotate-90"
          aria-hidden
        >
          <circle
            cx={MEDAL_SIZE / 2}
            cy={MEDAL_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="4"
          />
          <circle
            cx={MEDAL_SIZE / 2}
            cy={MEDAL_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={ringStroke(badge)}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={badge.unlocked ? 0 : dashOffset}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>

        <div
          className={`absolute inset-[7px] flex items-center justify-center rounded-full border shadow-sm ${
            badge.unlocked
              ? "border-white bg-white"
              : "border-slate-100 bg-slate-50"
          }`}
        >
          <Icon
            className={`h-7 w-7 ${badge.unlocked ? "" : "text-slate-300"}`}
            style={badge.unlocked ? { color: accent } : undefined}
            strokeWidth={badge.unlocked ? 2.1 : 1.6}
            aria-hidden
          />
        </div>

        <span
          className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow ${
            badge.unlocked ? "text-white" : "bg-slate-200 text-slate-400"
          }`}
          style={badge.unlocked ? { background: accent } : undefined}
        >
          {badge.unlocked ? <Check className="h-3 w-3" strokeWidth={3} /> : <Lock className="h-2.5 w-2.5" />}
        </span>
      </div>

      <h3
        className={`mt-2 line-clamp-2 w-full text-center text-[11px] font-semibold leading-tight ${
          badge.unlocked ? "text-slate-900" : "text-slate-500"
        }`}
      >
        {badge.title}
      </h3>

      {!badge.unlocked ? (
        <p className="mt-0.5 text-center text-[10px] font-medium tabular-nums text-slate-400">
          {badge.current}/{badge.target}
        </p>
      ) : badge.kind === "monthly" ? (
        <p className="mt-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-pink-600">Måned</p>
      ) : null}
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
            className="rounded-full border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50"
            aria-label={`Forrige ${title}`}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onScroll("right")}
            className="rounded-full border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50"
            aria-label={`Neste ${title}`}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="-mx-0.5 flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-0.5 pb-1 pt-0.5"
      >
        {badges.map((badge) => (
          <MedalBadge key={badge.id} badge={badge} />
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
    const amount = Math.max(160, Math.round(node.clientWidth * 0.75));
    node.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  }

  if (!totalCount) return null;

  return (
    <section
      className="min-w-0 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm sm:p-5"
      style={{ borderColor: "rgba(15,23,42,0.08)" }}
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex shrink-0 rounded-xl p-2 text-white shadow-sm"
          style={{ background: MOTUS_GRADIENT }}
        >
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
            <div
              className="h-full rounded-full"
              style={{ width: `${overallPct}%`, background: MOTUS_GRADIENT }}
            />
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

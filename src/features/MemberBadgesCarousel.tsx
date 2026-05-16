import { useRef } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Dumbbell,
  Flame,
  PlayCircle,
  Trophy,
  Zap,
} from "lucide-react";
import { MOTUS } from "../app/data";
import type { BadgeIconId, MemberBadge } from "../app/memberBadges";

const MOTUS_GRADIENT = `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`;
const BADGE_CARD_WIDTH_CLASS = "w-44 sm:w-48";

const BADGE_ICONS: Record<BadgeIconId, LucideIcon> = {
  "first-session": PlayCircle,
  "week-streak": Flame,
  sessions: Trophy,
  lift: Dumbbell,
  "lift-heavy": Zap,
  "month-goal": CalendarCheck,
};

type MemberBadgesCarouselProps = {
  badges: MemberBadge[];
};

export function MemberBadgesCarousel({ badges }: MemberBadgesCarouselProps) {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const unlockedCount = badges.filter((badge) => badge.unlocked).length;

  function scrollCarousel(direction: "left" | "right") {
    const node = carouselRef.current;
    if (!node) return;
    const amount = Math.max(200, Math.round(node.clientWidth * 0.85));
    node.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  }

  if (!badges.length) return null;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border-2 border-slate-200 bg-white p-3 shadow-md sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex shrink-0 rounded-lg p-1.5 text-white shadow-sm" style={{ background: MOTUS_GRADIENT }}>
            <Award className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Dine badges</h2>
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-teal-700">{unlockedCount} låst opp</span>
              <span className="text-slate-400"> · </span>
              <span>{badges.length - unlockedCount} gjenstår</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => scrollCarousel("left")}
            className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50"
            aria-label="Forrige badges"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollCarousel("right")}
            className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50"
            aria-label="Neste badges"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-3 text-[11px] font-medium">
        <span className="inline-flex items-center gap-1.5 text-teal-800">
          <span className="h-2.5 w-2.5 rounded-full ring-2 ring-teal-500" style={{ background: MOTUS_GRADIENT }} />
          Låst opp
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-500">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-slate-300 bg-slate-100" />
          Gjenstår
        </span>
      </div>

      <div
        ref={carouselRef}
        className="-mx-1 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pb-2"
      >
        {badges.map((badge) => {
          const Icon = BADGE_ICONS[badge.icon];
          const progressPct = badge.target > 0 ? Math.min(100, Math.round((badge.current / badge.target) * 100)) : 0;
          return (
            <article
              key={badge.id}
              className={`${BADGE_CARD_WIDTH_CLASS} shrink-0 snap-start flex flex-col rounded-2xl border-2 p-3.5 transition ${
                badge.unlocked
                  ? "border-teal-500 bg-gradient-to-br from-teal-100 via-white to-pink-100 shadow-md ring-1 ring-teal-400/40"
                  : "border-dashed border-slate-300 bg-slate-100/90"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    badge.unlocked ? "text-white shadow-sm" : "border border-slate-300 bg-white text-slate-500"
                  }`}
                  style={badge.unlocked ? { background: MOTUS_GRADIENT } : undefined}
                >
                  {badge.unlocked ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                      Låst opp
                    </>
                  ) : (
                    <>
                      <CircleDashed className="h-3 w-3" aria-hidden />
                      Gjenstår
                    </>
                  )}
                </span>
              </div>

              <div
                className={`mt-3 flex h-16 w-16 items-center justify-center rounded-2xl ${
                  badge.unlocked ? "text-white shadow-lg" : "border border-slate-200 bg-slate-200/80 text-slate-400"
                }`}
                style={badge.unlocked ? { background: MOTUS_GRADIENT } : undefined}
              >
                <Icon className="h-8 w-8" strokeWidth={badge.unlocked ? 2.25 : 1.75} aria-hidden />
              </div>

              <h3 className={`mt-3 text-sm font-bold leading-tight ${badge.unlocked ? "text-slate-900" : "text-slate-500"}`}>
                {badge.title}
              </h3>
              <p className={`mt-1 flex-1 text-[11px] leading-snug ${badge.unlocked ? "text-slate-700" : "text-slate-500"}`}>
                {badge.description}
              </p>

              {badge.unlocked ? (
                <p className="mt-3 text-xs font-semibold text-teal-800">Fullført · {badge.current}/{badge.target}</p>
              ) : (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                    <span>Fremdrift</span>
                    <span className="tabular-nums">
                      {badge.current}/{badge.target}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${progressPct}%`,
                        background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
                      }}
                    />
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

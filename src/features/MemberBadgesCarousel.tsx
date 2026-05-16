import { useRef } from "react";
import { Award, ChevronLeft, ChevronRight } from "lucide-react";
import { MOTUS } from "../app/data";
import type { MemberBadge } from "../app/memberBadges";

const MOTUS_GRADIENT = `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`;
const BADGE_CARD_WIDTH_CLASS = "w-40 sm:w-44";

type MemberBadgesCarouselProps = {
  badges: MemberBadge[];
};

export function MemberBadgesCarousel({ badges }: MemberBadgesCarouselProps) {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const unlockedCount = badges.filter((badge) => badge.unlocked).length;

  function scrollCarousel(direction: "left" | "right") {
    const node = carouselRef.current;
    if (!node) return;
    const amount = Math.max(180, Math.round(node.clientWidth * 0.85));
    node.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  }

  if (!badges.length) return null;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border bg-white p-3 shadow-sm sm:p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex shrink-0 rounded-lg p-1.5 text-white shadow-sm" style={{ background: MOTUS_GRADIENT }}>
            <Award className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Dine badges</h2>
            <p className="text-xs text-slate-500">
              {unlockedCount} av {badges.length} låst opp
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => scrollCarousel("left")}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Forrige badges"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollCarousel("right")}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Neste badges"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={carouselRef}
        className="-mx-1 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pb-2"
      >
        {badges.map((badge) => {
          const progressPct = badge.target > 0 ? Math.min(100, Math.round((badge.current / badge.target) * 100)) : 0;
          return (
            <article
              key={badge.id}
              className={`${BADGE_CARD_WIDTH_CLASS} shrink-0 snap-start flex flex-col rounded-2xl border p-3 transition ${
                badge.unlocked
                  ? "border-teal-200/90 bg-gradient-to-br from-teal-50/90 via-white to-pink-50/50 shadow-sm"
                  : "border-slate-200/90 bg-slate-50/80 opacity-90"
              }`}
              aria-label={`${badge.title}${badge.unlocked ? ", låst opp" : ", på vei"}`}
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${
                  badge.unlocked ? "bg-white shadow-sm ring-2 ring-teal-200/60" : "bg-white/70 grayscale-[0.35]"
                }`}
              >
                <span aria-hidden>{badge.emoji}</span>
              </div>
              <h3 className={`mt-3 text-sm font-semibold leading-tight ${badge.unlocked ? "text-slate-900" : "text-slate-600"}`}>
                {badge.title}
              </h3>
              <p className="mt-1 flex-1 text-[11px] leading-snug text-slate-500">{badge.description}</p>
              {!badge.unlocked ? (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                    <span>Fremdrift</span>
                    <span className="tabular-nums">
                      {badge.current}/{badge.target}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/90">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${progressPct}%`,
                        background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[11px] font-semibold text-emerald-700">Låst opp ✓</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

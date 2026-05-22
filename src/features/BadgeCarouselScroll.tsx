import type { ReactNode } from "react";

type BadgeCarouselScrollProps = {
  children: ReactNode;
  className?: string;
  trackClassName?: string;
};

/** Horisontal scroll — ingen overflow-y:hidden (klipper badge-hjørner). */
export function BadgeCarouselScroll({ children, className = "", trackClassName = "" }: BadgeCarouselScrollProps) {
  return (
    <div className={`motus-badge-carousel-outer ${className}`.trim()}>
      <div className="motus-badge-carousel-scroll motus-scroll-touch">
        <div className={`motus-badge-carousel-track ${trackClassName}`.trim()}>{children}</div>
      </div>
    </div>
  );
}

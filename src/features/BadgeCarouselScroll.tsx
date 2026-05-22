import type { ReactNode } from "react";

type BadgeCarouselScrollProps = {
  children: ReactNode;
  className?: string;
  trackClassName?: string;
};

/**
 * Horisontal badge-scroll: padding inni scrollboks slik at merker/glow ikke klippes vertikalt.
 */
export function BadgeCarouselScroll({ children, className = "", trackClassName = "" }: BadgeCarouselScrollProps) {
  return (
    <div className={`motus-badge-carousel-outer ${className}`.trim()}>
      <div className="motus-badge-carousel-scroll">
        <div className={`motus-badge-carousel-track ${trackClassName}`.trim()}>{children}</div>
      </div>
    </div>
  );
}

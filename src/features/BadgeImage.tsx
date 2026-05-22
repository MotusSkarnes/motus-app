import type { CSSProperties } from "react";

type BadgeImageSize = "card" | "catalog" | "hero" | "popup";

const SIZE_PX: Record<BadgeImageSize, number> = {
  card: 112,
  catalog: 96,
  hero: 176,
  popup: 192,
};

type BadgeImageProps = {
  src: string;
  alt?: string;
  size?: BadgeImageSize;
  dimmed?: boolean;
  className?: string;
  loading?: "lazy" | "eager";
};

/**
 * Badge-bilder rendres i fast kvadrat med overflow: visible slik at hjørner/sparkles
 * ikke klippes av scroll-containere (i motsetning til Tailwind overflow-x-auto + h/w-full).
 */
export function BadgeImage({ src, alt = "", size = "card", dimmed = false, className = "", loading = "lazy" }: BadgeImageProps) {
  const px = SIZE_PX[size];
  const frameStyle: CSSProperties = {
    width: px,
    height: px,
    minWidth: px,
    minHeight: px,
    overflow: "visible",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
  const imageStyle: CSSProperties = {
    display: "block",
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    objectPosition: "center",
    filter: dimmed ? "grayscale(1)" : undefined,
    opacity: dimmed ? 0.45 : 1,
  };

  return (
    <div className={`relative ${className}`.trim()} style={frameStyle}>
      <img src={src} alt={alt} className="motus-badge-art" style={imageStyle} loading={loading} decoding="async" />
    </div>
  );
}

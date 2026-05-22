import type { CSSProperties } from "react";

type BadgeImageSize = "card" | "catalog" | "hero" | "popup";

/** Layout-boks — PNG har allerede transparent kant etter normalisering. */
const SIZE_PX: Record<BadgeImageSize, number> = {
  card: 136,
  catalog: 120,
  hero: 192,
  popup: 224,
};

/** Liten innvendig luft så hex-hjørner ikke treffer bokskanten i UI. */
const SAFE_INSET = 0.04;

type BadgeImageProps = {
  src: string;
  alt?: string;
  size?: BadgeImageSize;
  dimmed?: boolean;
  className?: string;
  loading?: "lazy" | "eager";
};

export function BadgeImage({ src, alt = "", size = "card", dimmed = false, className = "", loading = "lazy" }: BadgeImageProps) {
  const px = SIZE_PX[size];
  const pad = Math.max(4, Math.round(px * SAFE_INSET));
  const frameStyle: CSSProperties = {
    width: px,
    height: px,
    minWidth: px,
    minHeight: px,
    boxSizing: "border-box",
    padding: pad,
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

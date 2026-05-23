import { badgeAssetUrl } from "../app/badgeAssets";

type BadgeImageSize = "card" | "cardCompact" | "catalog" | "detail" | "hero" | "popup" | "tile";

/** Ytre boks (layout-størrelse brukeren ser). */
const SIZE_PX: Record<BadgeImageSize, number> = {
  card: 260,
  cardCompact: 108,
  tile: 92,
  catalog: 210,
  detail: 176,
  hero: 280,
  popup: 320,
};

/** Minimal luft — motivet fyller PNG-canvas tett etter normalisering. */
const FRAME_INSET_RATIO = 0;

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
  const pad = Math.round(px * FRAME_INSET_RATIO);
  const inner = px - pad * 2;
  const resolvedSrc = src.includes("?v=") ? src : badgeAssetUrl(src);

  return (
    <span
      className={`motus-badge-frame inline-flex shrink-0 items-center justify-center overflow-visible ${className}`.trim()}
      style={{ width: px, height: px, boxSizing: "border-box", padding: pad }}
    >
      <img
        src={resolvedSrc}
        alt={alt}
        width={inner}
        height={inner}
        loading={loading}
        decoding="async"
        className={`motus-badge-img block object-contain ${dimmed ? "opacity-45 grayscale" : ""}`}
        style={{ width: inner, height: inner, maxWidth: inner, maxHeight: inner }}
      />
    </span>
  );
}

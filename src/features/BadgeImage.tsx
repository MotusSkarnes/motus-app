import { badgeAssetUrl } from "../app/badgeAssets";

type BadgeImageSize = "card" | "catalog" | "hero" | "popup";

/** Ytre boks (layout-størrelse brukeren ser). */
const SIZE_PX: Record<BadgeImageSize, number> = {
  card: 200,
  catalog: 176,
  hero: 240,
  popup: 280,
};

/** Ekstra luft inni boksen — PNG har også kant etter normalisering (SAFE_FILL). */
const FRAME_INSET_RATIO = 0.06;

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
  const pad = Math.max(6, Math.round(px * FRAME_INSET_RATIO));
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

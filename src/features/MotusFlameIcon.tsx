export const MOTUS_STREAK_FLAME_IMAGE = "/icons/motus-streak-flame.png";

type MotusFlameIconProps = {
  className?: string;
  title?: string;
  /** Beholdt for bakoverkompatibilitet – flammebildet har fast Motus-design. */
  tone?: "gradient" | "solid";
};

export function MotusFlameIcon({ className = "h-4 w-4", title }: MotusFlameIconProps) {
  return (
    <img
      src={MOTUS_STREAK_FLAME_IMAGE}
      alt={title ?? ""}
      className={`object-contain ${className}`}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      draggable={false}
      loading="lazy"
    />
  );
}

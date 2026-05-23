import { useId } from "react";
import { MOTUS } from "../app/data";

type MotusFlameIconProps = {
  className?: string;
  title?: string;
  /** Gradient (brand) or currentColor for badges on gradient backgrounds. */
  tone?: "gradient" | "solid";
};

export function MotusFlameIcon({ className = "h-4 w-4", title, tone = "gradient" }: MotusFlameIconProps) {
  const gradientId = useId();

  if (tone === "solid") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="currentColor"
        aria-hidden={title ? undefined : true}
        role={title ? "img" : undefined}
      >
        {title ? <title>{title}</title> : null}
        <path d="M12 22c4.2-3.2 6.8-7 6.8-11.5 0-2.1-.7-4-1.8-5.7C16.2 3.6 14.4 2.5 12 2.5S7.8 3.6 6.9 4.8C5.9 6.5 5.2 8.4 5.2 10.5 5.2 15 7.8 18.8 12 22Z" />
        <path
          d="M12 18.8c2.1-1.7 3.4-3.8 3.4-6.3 0-1.2-.4-2.3-1-3.2-.5-.8-1.2-1.3-2.4-1.3s-1.9.5-2.4 1.3c-.6.9-1 2-1 3.2 0 2.5 1.3 4.6 3.4 6.3Z"
          fill="white"
          fillOpacity={0.32}
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={gradientId} x1="4" y1="22" x2="20" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={MOTUS.turquoise} />
          <stop offset="100%" stopColor={MOTUS.pink} />
        </linearGradient>
      </defs>
      <path
        d="M12 22c4.2-3.2 6.8-7 6.8-11.5 0-2.1-.7-4-1.8-5.7C16.2 3.6 14.4 2.5 12 2.5S7.8 3.6 6.9 4.8C5.9 6.5 5.2 8.4 5.2 10.5 5.2 15 7.8 18.8 12 22Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M12 18.8c2.1-1.7 3.4-3.8 3.4-6.3 0-1.2-.4-2.3-1-3.2-.5-.8-1.2-1.3-2.4-1.3s-1.9.5-2.4 1.3c-.6.9-1 2-1 3.2 0 2.5 1.3 4.6 3.4 6.3Z"
        fill={MOTUS.paleMint}
        fillOpacity={0.85}
      />
    </svg>
  );
}

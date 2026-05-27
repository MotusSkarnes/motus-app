import { MOTUS } from "../../app/data";

type MacroProgressRingProps = {
  label: string;
  current: number;
  target: number;
  unit?: string;
  tone?: "mint" | "pink";
  size?: "sm" | "lg";
  sublabel?: string | null;
};

export function MacroProgressRing({
  label,
  current,
  target,
  unit = "",
  tone = "mint",
  size = "lg",
  sublabel,
}: MacroProgressRingProps) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const stroke = tone === "pink" ? MOTUS.pink : MOTUS.turquoise;
  const dim = size === "sm" ? 52 : 88;
  const r = size === "sm" ? 20 : 34;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  const center = dim / 2;
  const displayCurrent = Math.round(current);
  const displayTarget = Math.round(target);

  return (
    <div className={`motus-matplan-ring motus-matplan-ring--${size}`}>
      <div className="motus-matplan-ring__graphic" style={{ width: dim, height: dim }}>
        <svg viewBox={`0 0 ${dim} ${dim}`} className="h-full w-full" aria-hidden>
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="rgba(48,227,190,0.14)"
            strokeWidth={size === "sm" ? 4 : 6}
          />
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth={size === "sm" ? 4 : 6}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(2, dash)} ${circumference}`}
            transform={`rotate(-90 ${center} ${center})`}
          />
        </svg>
        {size === "lg" ? (
          <div className="motus-matplan-ring__center">
            <span className="motus-matplan-ring__value">
              {displayCurrent}
              {unit}
            </span>
            <span className="motus-matplan-ring__target">
              / {displayTarget}
              {unit}
            </span>
          </div>
        ) : null}
      </div>
      {size === "sm" ? (
        <div className="motus-matplan-ring__sm-text">
          <span className="motus-matplan-ring__sm-value">
            {displayCurrent}
            {unit ? ` ${unit}` : ""}
          </span>
          <span className="motus-matplan-ring__sm-target">
            / {displayTarget}
            {unit ? unit : ""}
          </span>
        </div>
      ) : null}
      <span className="motus-matplan-ring__label">{label}</span>
      {sublabel ? <span className="motus-matplan-ring__sublabel">{sublabel}</span> : null}
    </div>
  );
}

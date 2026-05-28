import type { ReactNode } from "react";
import { MOTUS } from "../../app/data";

type MacroProgressBarProps = {
  label: string;
  current: number;
  target: number;
  unit?: string;
  icon?: ReactNode;
};

export function MacroProgressBar({ label, current, target, unit = "g", icon }: MacroProgressBarProps) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const displayCurrent = Math.round(current);
  const displayTarget = Math.round(target);

  return (
    <div className="motus-matplan-macro-bar">
      <div className="motus-matplan-macro-bar__head">
        <div className="motus-matplan-macro-bar__label-row">
          {icon ? <span className="motus-matplan-macro-bar__icon">{icon}</span> : null}
          <span className="motus-matplan-macro-bar__label">{label}</span>
        </div>
        <span className="motus-matplan-macro-bar__values">
          {displayCurrent}
          {unit} / {displayTarget}
          {unit} <span className="motus-matplan-macro-bar__pct">{pct}%</span>
        </span>
      </div>
      <div className="motus-matplan-macro-bar__track" aria-hidden>
        <div
          className="motus-matplan-macro-bar__fill"
          style={{ width: `${pct}%`, backgroundColor: MOTUS.turquoise }}
        />
      </div>
    </div>
  );
}

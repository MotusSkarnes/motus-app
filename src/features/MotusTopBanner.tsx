import type { ReactNode } from "react";
import { MOTUS } from "../app/data";
import { Card } from "../app/ui";
import motusLogo from "../assets/motus-logo-transparent.svg";

export type MotusTopBannerProps = {
  actions: ReactNode;
  notificationsPanel?: ReactNode | null;
  footer?: ReactNode | null;
};

export function MotusTopBanner({ actions, notificationsPanel, footer }: MotusTopBannerProps) {
  return (
    <Card className="overflow-hidden bg-[linear-gradient(90deg,rgba(48,227,190,0.07)_0%,rgba(217,18,120,0.07)_100%)] p-3 sm:p-4 md:p-5">
      <div
        className="-mx-3 -mt-3 mb-3 h-1 sm:-mx-4 sm:-mt-4 sm:mb-4 md:-mx-5 md:-mt-5"
        style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 70%, ${MOTUS.acid} 100%)` }}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-3">
        <img src={motusLogo} alt="Motus logo" className="h-10 w-auto object-contain sm:h-11" />
        {actions}
      </div>
      {notificationsPanel ? <div className="mt-3">{notificationsPanel}</div> : null}
      {footer ? <div className="mt-3 border-t border-slate-200/80 pt-3">{footer}</div> : null}
    </Card>
  );
}

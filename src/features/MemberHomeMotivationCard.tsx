import { ChevronRight, Flag } from "lucide-react";

export function MemberHomeMotivationCard({
  title,
  detail,
  onClick,
}: {
  title: string;
  detail: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="motus-home-motivation-icon" aria-hidden>
        <Flag className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{detail}</p>
      </span>
      {onClick ? <ChevronRight className="h-4 w-4 shrink-0 text-[#0d9488]" aria-hidden /> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="motus-home-motivation-card motus-pressable w-full text-left">
        {inner}
      </button>
    );
  }

  return <aside className="motus-home-motivation-card">{inner}</aside>;
}

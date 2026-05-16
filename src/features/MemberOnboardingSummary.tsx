import { formatOnboardingSummaryLines, resolveMemberOnboarding } from "../app/memberOnboarding";
import type { Member } from "../app/types";
import { Card } from "../app/ui";

type MemberOnboardingSummaryProps = {
  member: Member;
  variant?: "card" | "inline";
  tone?: "light" | "dark";
  className?: string;
};

export function MemberOnboardingSummary({
  member,
  variant = "card",
  tone = "light",
  className = "",
}: MemberOnboardingSummaryProps) {
  const onboarding = resolveMemberOnboarding(member);
  const isDark = tone === "dark";
  if (!onboarding) {
    const empty = (
      <p className={`text-sm ${isDark ? "text-white/75" : "text-slate-500"} ${className}`}>
        Medlemmet har ikke fullført oppstartsskjema ennå.
      </p>
    );
    return variant === "card" ? <Card className={`p-4 ${className}`}>{empty}</Card> : empty;
  }

  const lines = formatOnboardingSummaryLines(onboarding);
  const completedLabel = onboarding.completedAt
    ? new Date(onboarding.completedAt).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const content = (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Oppstartsskjema</h4>
        {completedLabel ? (
          <span className={`text-xs ${isDark ? "text-white/70" : "text-slate-500"}`}>Fullført {completedLabel}</span>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {lines.map((line) => (
          <div
            key={line.label}
            className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-white/20 bg-white/10" : "bg-slate-50/80"}`}
            style={isDark ? undefined : { borderColor: "rgba(15,23,42,0.08)" }}
          >
            <div className={`text-[11px] font-semibold uppercase tracking-wide ${isDark ? "text-white/65" : "text-slate-500"}`}>
              {line.label}
            </div>
            <div className={`mt-0.5 font-medium ${isDark ? "text-white/95" : "text-slate-800"}`}>{line.value}</div>
          </div>
        ))}
      </div>
    </div>
  );

  if (variant === "inline") return content;
  return <Card className="p-4 sm:p-5">{content}</Card>;
}

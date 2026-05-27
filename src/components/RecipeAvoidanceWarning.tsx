import { AlertTriangle } from "lucide-react";
import type { RecipeFoodAvoidanceConflict } from "../app/memberFoodAvoidances";

type RecipeAvoidanceWarningProps = {
  conflicts: RecipeFoodAvoidanceConflict[];
  title?: string;
  className?: string;
};

export function RecipeAvoidanceWarning({ conflicts, title, className = "" }: RecipeAvoidanceWarningProps) {
  if (!conflicts.length) return null;

  const byMember = new Map<string, { name: string; rows: RecipeFoodAvoidanceConflict[] }>();
  for (const row of conflicts) {
    const bucket = byMember.get(row.memberId) ?? { name: row.memberName, rows: [] };
    bucket.rows.push(row);
    byMember.set(row.memberId, bucket);
  }

  const memberCount = byMember.size;
  const heading =
    title ??
    (memberCount === 1
      ? "Medlem unngår ingredienser i denne oppskriften"
      : `${memberCount} medlemmer unngår ingredienser i denne oppskriften`);

  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 space-y-2">
          <p className="font-semibold">{heading}</p>
          <ul className="space-y-1.5 text-xs leading-relaxed">
            {Array.from(byMember.values()).map((member) => (
              <li key={member.name}>
                <span className="font-semibold">{member.name}:</span>{" "}
                {member.rows.map((row) => `${row.avoidanceLabel} (↔ ${row.ingredientLabel})`).join(" · ")}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-amber-900/80">
            Du kan fortsatt publisere — sjekk med medlemmet eller bytt ingredienser i oppskriften.
          </p>
        </div>
      </div>
    </div>
  );
}

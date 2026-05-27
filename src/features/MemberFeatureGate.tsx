import { Lock } from "lucide-react";
import { Card } from "../app/ui";

export type MemberFeatureGateVariant = "premium" | "nutrition";

const COPY: Record<MemberFeatureGateVariant, string> = {
  premium:
    "Du har ikke tilgang til denne funksjonen. Oppgrader medlemskap til Premium for å få tilgang.",
  nutrition:
    "Du har ikke tilgang til denne funksjonen. Ta kontakt med resepsjonen for å få info om hvordan du kan få tilgang.",
};

type MemberFeatureGateProps = {
  variant: MemberFeatureGateVariant;
};

export function MemberFeatureGate({ variant }: MemberFeatureGateProps) {
  return (
    <Card className="mx-auto max-w-lg p-6 text-center shadow-sm ring-1 ring-black/5 sm:p-8">
      <Lock className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
      <h2 className="mt-4 text-lg font-semibold text-slate-900">Ingen tilgang</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{COPY[variant]}</p>
    </Card>
  );
}

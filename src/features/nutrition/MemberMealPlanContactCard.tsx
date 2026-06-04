import { Mail, MessageCircle } from "lucide-react";
import { MOTUS_NUTRITION_ADVISOR_EMAIL } from "../../app/nutritionAdvisor";
import { Card, GradientButton, OutlineButton } from "../../app/ui";

type MemberMealPlanContactCardProps = {
  onOpenMessages?: () => void;
};

export function MemberMealPlanContactCard({ onOpenMessages }: MemberMealPlanContactCardProps) {
  const mailto = `mailto:${MOTUS_NUTRITION_ADVISOR_EMAIL}?subject=${encodeURIComponent("Forespørsel om matplan")}`;

  return (
    <Card className="border-teal-100 bg-gradient-to-br from-teal-50/90 to-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-slate-900">Ønsker du en matplan?</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        Ta kontakt med vår kostholdsveileder, så hjelper vi deg i gang.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {onOpenMessages ? (
          <GradientButton type="button" className="inline-flex items-center justify-center gap-2" onClick={onOpenMessages}>
            <MessageCircle className="h-4 w-4" aria-hidden />
            Send melding
          </GradientButton>
        ) : null}
        <OutlineButton
          type="button"
          className="inline-flex items-center justify-center gap-2"
          onClick={() => {
            window.location.href = mailto;
          }}
        >
          <Mail className="h-4 w-4" aria-hidden />
          {MOTUS_NUTRITION_ADVISOR_EMAIL}
        </OutlineButton>
      </div>
    </Card>
  );
}

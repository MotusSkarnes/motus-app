import { BookOpen, ClipboardList, Sparkles, TrendingUp } from "lucide-react";
import motusLogo from "../assets/motus-logo-transparent.svg";
import { MOTUS } from "../app/data";
import { Card, GradientButton, OutlineButton } from "../app/ui";

type MemberWelcomeModalProps = {
  memberName: string;
  needsOnboarding: boolean;
  onStartOnboarding: () => void;
  onBrowseTips: () => void;
  onDismiss: () => void;
};

export function MemberWelcomeModal({
  memberName,
  needsOnboarding,
  onStartOnboarding,
  onBrowseTips,
  onDismiss,
}: MemberWelcomeModalProps) {
  const firstName = memberName.trim().split(/\s+/)[0] || "der";

  return (
    <div
      className="motus-modal-insets fixed inset-0 z-[10040] flex items-end justify-center overflow-y-auto overscroll-contain bg-slate-900/55 px-4 py-8 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-welcome-title"
    >
      <Card className="w-full max-w-lg overflow-hidden p-0 shadow-xl ring-1 ring-black/10">
        <div
          className="px-5 py-5 sm:px-6 sm:py-6"
          style={{ background: `linear-gradient(155deg, rgba(20,184,166,0.12) 0%, rgba(236,72,153,0.08) 55%, #fff 100%)` }}
        >
          <div className="flex items-center gap-3">
            <img src={motusLogo} alt="" className="h-10 w-auto sm:h-11" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Motus Coach</div>
              <h2 id="member-welcome-title" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Velkommen, {firstName}!
              </h2>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
            Her får du treningsprogram, logger økter, følger fremgang og holder kontakt med PT — alt på ett sted.
          </p>
        </div>

        <div className="space-y-3 px-5 pb-2 sm:px-6">
          <WelcomePoint
            icon={ClipboardList}
            title="Trening"
            text="Start program, bruk øktmodus og lag egne økter under Trening."
          />
          <WelcomePoint
            icon={TrendingUp}
            title="Fremgang"
            text="Se historikk, streak og personlige rekorder etter hvert du trener."
          />
          <WelcomePoint
            icon={Sparkles}
            title="Inspirasjon"
            text="Under Inspo finner du oppskrifter, nyheter og Råd og tips — inkludert bruksanvisninger for appen."
          />
          <WelcomePoint
            icon={BookOpen}
            title="Oppstartsskjema"
            text={
              needsOnboarding
                ? "Fyll ut onboarding én gang (ca. 3–5 min) så PT kan lage et program tilpasset deg. Har du ikke tid nå, finner du skjemaet igjen under Profil."
                : "Du har allerede fylt ut oppstartsskjema. Du kan åpne og oppdatere det under Profil når du vil."
            }
          />
        </div>

        <div className="flex flex-col gap-2 border-t px-5 py-4 sm:px-6" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          {needsOnboarding ? (
            <GradientButton type="button" onClick={onStartOnboarding} className="w-full">
              Fyll ut startskjema nå
            </GradientButton>
          ) : (
            <GradientButton type="button" onClick={onDismiss} className="w-full">
              Kom i gang
            </GradientButton>
          )}
          <OutlineButton type="button" onClick={onBrowseTips} className="w-full">
            Se tips og råd i Inspo
          </OutlineButton>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-2 text-center text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            {needsOnboarding ? "Jeg gjør det senere" : "Lukk"}
          </button>
        </div>
      </Card>
    </div>
  );
}

function WelcomePoint({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ClipboardList;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border bg-slate-50/80 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
        style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <p className="mt-0.5 text-sm leading-snug text-slate-600">{text}</p>
      </div>
    </div>
  );
}

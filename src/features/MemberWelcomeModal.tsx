import { useState } from "react";
import { CalendarRange, ClipboardList, MessageSquare, TrendingUp, type LucideIcon } from "lucide-react";
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

type TourStep = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    icon: ClipboardList,
    title: "Her starter du økter",
    text: "Gå til Trening for å starte program fra PT eller bygge din egen økt.",
  },
  {
    icon: CalendarRange,
    title: "Her ser du planen din",
    text: "På Hjem og under Periodeplan ser du hva som er planlagt denne uken.",
  },
  {
    icon: MessageSquare,
    title: "Her sender du melding til PT",
    text: "Bruk Meldinger når du trenger hjelp, justeringer eller har spørsmål.",
  },
  {
    icon: TrendingUp,
    title: "Her følger du fremgang",
    text: "Fremgang viser historikk, streak, personlige rekorder og badges.",
  },
];

export function MemberWelcomeModal({
  memberName,
  needsOnboarding,
  onStartOnboarding,
  onBrowseTips,
  onDismiss,
}: MemberWelcomeModalProps) {
  const firstName = memberName.trim().split(/\s+/)[0] || "der";
  const [stepIndex, setStepIndex] = useState(0);
  const activeStep = TOUR_STEPS[stepIndex];
  const ActiveIcon = activeStep.icon;
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;

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
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">En rask gjennomgang før du starter.</p>
        </div>

        <div className="px-5 pb-2 sm:px-6">
          <div className="rounded-2xl border bg-slate-50/80 p-5 text-center" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <span
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
            >
              <ActiveIcon className="h-6 w-6" aria-hidden />
            </span>
            <div className="mt-4 text-lg font-bold text-slate-950">{activeStep.title}</div>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">{activeStep.text}</p>
            <div className="mt-5 flex items-center justify-center gap-2" aria-label="Tour-steg">
              {TOUR_STEPS.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => setStepIndex(index)}
                  className={`h-2.5 rounded-full transition-all ${index === stepIndex ? "w-7 bg-teal-600" : "w-2.5 bg-slate-300"}`}
                  aria-label={`Gå til steg ${index + 1}`}
                />
              ))}
            </div>
          </div>
          {needsOnboarding ? (
            <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
              Etterpå kan du fylle ut startskjemaet, så PT får bedre grunnlag for planen din.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t px-5 py-4 sm:px-6" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          {!isLastStep ? (
            <GradientButton type="button" onClick={() => setStepIndex((current) => Math.min(current + 1, TOUR_STEPS.length - 1))} className="w-full">
              Neste
            </GradientButton>
          ) : needsOnboarding ? (
            <GradientButton type="button" onClick={onStartOnboarding} className="w-full">
              Fyll ut startskjema nå
            </GradientButton>
          ) : (
            <GradientButton type="button" onClick={onDismiss} className="w-full">
              Kom i gang
            </GradientButton>
          )}
          {stepIndex > 0 ? (
            <OutlineButton type="button" onClick={() => setStepIndex((current) => Math.max(current - 1, 0))} className="w-full">
              Tilbake
            </OutlineButton>
          ) : (
            <OutlineButton type="button" onClick={onBrowseTips} className="w-full">
              Se tips og råd i Inspo
            </OutlineButton>
          )}
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

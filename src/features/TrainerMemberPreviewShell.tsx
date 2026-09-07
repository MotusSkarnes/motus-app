import type { ReactNode } from "react";

type TrainerMemberPreviewShellProps = {
  clientName?: string;
  children: ReactNode;
  onExit: () => void;
};

/** Phone-sized frame so trainers can preview the member app as on mobile. */
export function TrainerMemberPreviewShell({ clientName, children, onExit }: TrainerMemberPreviewShellProps) {
  const title = clientName?.trim() ? `Klientvisning · ${clientName.trim()}` : "Klientvisning";

  return (
    <div className="motus-client-preview">
      <div className="motus-client-preview__toolbar">
        <div className="min-w-0">
          <p className="motus-client-preview__eyebrow">Forhåndsvisning</p>
          <h2 className="motus-client-preview__title">{title}</h2>
          <p className="motus-client-preview__hint">Vises i mobilformat — slik kunden typisk ser appen</p>
        </div>
        <button type="button" className="motus-client-preview__exit motus-pressable" onClick={onExit}>
          Til PT-visning
        </button>
      </div>

      <div className="motus-client-preview__stage">
        <div className="motus-client-preview__device" aria-label="Mobil forhåndsvisning">
          <div className="motus-client-preview__speaker" aria-hidden />
          <div className="motus-client-preview__screen">{children}</div>
          <div className="motus-client-preview__home-indicator" aria-hidden />
        </div>
      </div>
    </div>
  );
}

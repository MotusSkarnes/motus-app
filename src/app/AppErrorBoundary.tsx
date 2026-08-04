import { Component, type ErrorInfo, type ReactNode } from "react";
import { isStaleAppShellError, recoverStaleAppShellOnce } from "./recoverStaleAppShell";
import { Card, OutlineButton } from "./ui";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
  recovering: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, recovering: false };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App render failed:", error, info.componentStack);
    if (!isStaleAppShellError(error)) return;
    this.setState({ recovering: true });
    void recoverStaleAppShellOnce(error).then((didRecover) => {
      if (!didRecover) this.setState({ recovering: false });
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    if (this.state.recovering) {
      return (
        <Card className="mx-auto max-w-lg p-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Oppdaterer appen…</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            En gammel app-versjon ble oppdaget. Vi laster siden på nytt. Treningsdata og profil blir ikke slettet.
          </p>
        </Card>
      );
    }

    const message = this.state.error.message?.trim() || "Ukjent feil";
    const staleShell = isStaleAppShellError(this.state.error);

    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Noe gikk galt</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {staleShell
            ? "Appen kunne ikke lastes ferdig. Prøv igjen — dette sletter ikke treningsdata eller profil."
            : "Appen kunne ikke vises. Prøv å laste siden på nytt. Hvis problemet fortsetter, logg ut og inn igjen."}
        </p>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-500">{message}</p>
        <OutlineButton
          type="button"
          onClick={() => {
            if (staleShell) {
              void recoverStaleAppShellOnce(this.state.error).then((didRecover) => {
                if (!didRecover) window.location.reload();
              });
              return;
            }
            window.location.reload();
          }}
          className="mt-5 w-full sm:w-auto"
        >
          Prøv igjen
        </OutlineButton>
      </Card>
    );
  }
}

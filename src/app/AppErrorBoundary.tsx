import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card, OutlineButton } from "./ui";
import { reportClientError } from "./clientErrorReporter";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App render failed:", error, info.componentStack);
    reportClientError("react-render-error", error, { componentStack: info.componentStack?.slice(0, 4000) ?? "" });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message?.trim() || "Ukjent feil";

    return (
      <Card className="fixed inset-x-4 top-1/2 z-[20000] mx-auto max-w-lg -translate-y-1/2 p-6 text-center shadow-2xl">
        <h1 className="text-lg font-semibold text-slate-900">Noe gikk galt</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Appen kunne ikke vises. Prøv å laste siden på nytt. Hvis problemet fortsetter, logg ut og inn igjen.
        </p>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-500">{message}</p>
        <OutlineButton type="button" onClick={() => window.location.reload()} className="mt-5 w-full sm:w-auto">
          Last siden på nytt
        </OutlineButton>
      </Card>
    );
  }
}

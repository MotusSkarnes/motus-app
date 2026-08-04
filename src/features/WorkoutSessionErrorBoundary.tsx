import { Component, type ErrorInfo, type ReactNode } from "react";
import { OutlineButton } from "../app/ui";

type WorkoutSessionErrorBoundaryProps = {
  children: ReactNode;
  /** Lukker øktmodus uten å slette treningsdata. */
  onClose: () => void;
  title?: string;
};

type WorkoutSessionErrorBoundaryState = {
  error: Error | null;
};

/**
 * Fang render-feil i økt/intervall-UI uten å blanke hele medlemsappen.
 * Rører ikke localStorage eller skydata.
 */
export class WorkoutSessionErrorBoundary extends Component<
  WorkoutSessionErrorBoundaryProps,
  WorkoutSessionErrorBoundaryState
> {
  state: WorkoutSessionErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): WorkoutSessionErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Workout session render failed:", error, info.componentStack);
  }

  private handleClose = () => {
    this.setState({ error: null });
    this.props.onClose();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message?.trim() || "Ukjent feil";
    const title = this.props.title?.trim() || "Kunne ikke åpne økten";

    return (
      <div className="fixed inset-0 z-[10020] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-xl">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Programmet kunne ikke vises akkurat nå. Treningsdataene dine er trygge — prøv igjen, eller lukk og åpne
            programmet på nytt.
          </p>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-500">{message}</p>
          <OutlineButton type="button" onClick={this.handleClose} className="mt-5 w-full">
            Lukk og prøv igjen
          </OutlineButton>
        </div>
      </div>
    );
  }
}

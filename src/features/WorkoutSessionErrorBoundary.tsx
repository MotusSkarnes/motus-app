import { Component, type ErrorInfo, type ReactNode } from "react";
import { OutlineButton } from "../app/ui";

type WorkoutSessionErrorBoundaryProps = {
  children: ReactNode;
  sessionKey: string;
  onClose: () => void;
};

type WorkoutSessionErrorBoundaryState = {
  error: Error | null;
};

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

  componentDidUpdate(previousProps: WorkoutSessionErrorBoundaryProps) {
    if (previousProps.sessionKey !== this.props.sessionKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  private closeSession = () => {
    this.setState({ error: null });
    this.props.onClose();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-950 p-4 text-slate-900"
        role="alert"
        aria-live="assertive"
      >
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
          <h2 className="text-lg font-bold">Kunne ikke åpne økten</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Det er en feil i dataene for denne økten. Lukk økten og prøv igjen, eller kontakt PT-en din hvis
            problemet fortsetter.
          </p>
          <OutlineButton type="button" onClick={this.closeSession} className="mt-5 w-full">
            Lukk økten
          </OutlineButton>
        </div>
      </div>
    );
  }
}

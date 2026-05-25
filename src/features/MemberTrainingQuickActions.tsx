import { CalendarRange, Dumbbell, History, LayoutGrid, PlusCircle } from "lucide-react";

export type TrainingQuickSection = "today" | "period" | "programs" | "custom" | "history";

type MemberTrainingQuickActionsProps = {
  activeSection: TrainingQuickSection;
  onNavigate: (section: TrainingQuickSection) => void;
  hideCustom?: boolean;
};

const ACTIONS: Array<{
  id: TrainingQuickSection;
  label: string;
  icon: typeof CalendarRange;
  tone: "teal" | "pink";
}> = [
  { id: "today", label: "Trening", icon: LayoutGrid, tone: "teal" },
  { id: "period", label: "Plan", icon: CalendarRange, tone: "pink" },
  { id: "programs", label: "Programmer", icon: Dumbbell, tone: "teal" },
  { id: "custom", label: "Ny økt", icon: PlusCircle, tone: "pink" },
  { id: "history", label: "Historikk", icon: History, tone: "teal" },
];

export function MemberTrainingQuickActions({ activeSection, onNavigate, hideCustom }: MemberTrainingQuickActionsProps) {
  const items = hideCustom ? ACTIONS.filter((item) => item.id !== "custom") : ACTIONS;

  return (
    <div className="motus-training-quick-actions scrollbar-none" role="navigation" aria-label="Trening hurtighandlinger">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`motus-training-quick-action motus-pressable ${isActive ? "is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <span className={`motus-training-quick-action-icon motus-training-quick-action-icon--${item.tone}`}>
              <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <span className="motus-training-quick-action-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

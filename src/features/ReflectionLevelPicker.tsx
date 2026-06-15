import {
  reflectionLevelToStorage,
  reflectionLevelToUi,
  workoutReflectionEmoji,
  type ReflectionLevel,
} from "../app/activityWorkoutLog";

type ReflectionLevelPickerProps = {
  question: string;
  value: ReflectionLevel;
  onChange: (level: ReflectionLevel) => void;
};

export function ReflectionLevelPicker({ question, value, onChange }: ReflectionLevelPickerProps) {
  const uiValue = reflectionLevelToUi(value);

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-slate-700">{question}</div>
      <div className="grid grid-cols-5 gap-2">
        {([5, 4, 3, 2, 1] as const).map((uiLevel) => {
          const active = uiValue === uiLevel;
          return (
            <button
              key={uiLevel}
              type="button"
              onClick={() => onChange(reflectionLevelToStorage(uiLevel))}
              className={`rounded-xl border px-2 py-2 text-lg transition ${
                active ? "border-teal-400 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
              aria-label={`Velg nivå ${uiLevel} av 5`}
            >
              {workoutReflectionEmoji(uiLevel)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

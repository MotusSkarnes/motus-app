import type { ReactNode, SyntheticEvent } from "react";
import { Plus, Star } from "lucide-react";
import { exerciseCategoryAccentColor } from "../app/exerciseCategories";
import { resolveExerciseImageSrc } from "../app/exerciseIllustrations";
import { EXERCISE_IMAGE_MEDIUM_CLASS, EXERCISE_IMAGE_SMALL_CLASS } from "../app/exerciseIllustrations/constants";
import { isPopularExercise, isRecommendedExercise } from "../app/exerciseBankStats";
import { muscleGroupChipClass } from "../app/customWorkoutBuilder";
import type { Exercise } from "../app/types";
import { splitMuscleGroupLabel } from "./muscleSplitStats";

export type ExerciseBankBadgeVariant = "trainer" | "member";

type ExerciseBankBadgesProps = {
  popularity: number;
  isFavorite?: boolean;
  isTrainerProgram?: boolean;
  variant: ExerciseBankBadgeVariant;
};

export function ExerciseBankBadges({ popularity, isFavorite = false, isTrainerProgram = false, variant }: ExerciseBankBadgesProps) {
  const badges: ReactNode[] = [];

  if (variant === "trainer" && isFavorite) {
    badges.push(
      <span key="pt-fav" className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        PT favoritt
      </span>,
    );
  }

  if (variant === "member" && isTrainerProgram) {
    badges.push(
      <span key="trainer" className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-900">
        Fra trener
      </span>,
    );
  }

  if (isRecommendedExercise(popularity, false)) {
    badges.push(
      <span key="rec" className="rounded-full motus-brand-fill px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        Anbefalt
      </span>,
    );
  } else if (isPopularExercise(popularity)) {
    badges.push(
      <span key="pop" className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
        Ofte brukt
      </span>,
    );
  }

  if (!badges.length) return null;

  return <div className="flex flex-wrap items-center gap-1.5">{badges}</div>;
}

type ExerciseBankListCardProps = {
  exercise: Exercise;
  popularity?: number;
  isFavorite?: boolean;
  isTrainerProgram?: boolean;
  badgeVariant?: ExerciseBankBadgeVariant;
  imageSrc?: string;
  onImageError?: (event: SyntheticEvent<HTMLImageElement>) => void;
  added?: boolean;
  onAdd?: () => void;
  onToggleFavorite?: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  compact?: boolean;
  className?: string;
  trailing?: ReactNode;
  onMainClick?: () => void;
  showAddButton?: boolean;
};

export function ExerciseBankListCard({
  exercise,
  popularity = 0,
  isFavorite = false,
  isTrainerProgram = false,
  badgeVariant = "member",
  imageSrc,
  onImageError,
  added = false,
  onAdd,
  onToggleFavorite,
  draggable = false,
  onDragStart,
  onDragEnd,
  compact = false,
  className = "",
  trailing,
  onMainClick,
  showAddButton = true,
}: ExerciseBankListCardProps) {
  const accent = exerciseCategoryAccentColor(exercise.category);
  const imageClass = compact ? EXERCISE_IMAGE_SMALL_CLASS : EXERCISE_IMAGE_MEDIUM_CLASS;
  const muscleParts = splitMuscleGroupLabel(exercise.group).slice(0, compact ? 2 : 3);

  const mainContent = (
    <>
      <img
        src={imageSrc ?? resolveExerciseImageSrc(exercise)}
        alt=""
        className={`${imageClass} shadow-sm`}
        style={{ borderColor: `${accent}66` }}
        loading="lazy"
        decoding="async"
        onError={onImageError}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className={`truncate font-semibold text-slate-900 ${compact ? "text-sm" : "text-sm leading-tight"}`}>{exercise.name}</div>
          <ExerciseBankBadges
            popularity={popularity}
            isFavorite={isFavorite}
            isTrainerProgram={isTrainerProgram}
            variant={badgeVariant}
          />
        </div>
        <div className={`mt-0.5 text-slate-500 ${compact ? "text-[11px]" : "text-xs"}`}>
          {exercise.category}
          {!compact && exercise.equipment ? ` · ${exercise.equipment}` : null}
        </div>
        {muscleParts.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {muscleParts.map((part) => (
              <span
                key={part}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${muscleGroupChipClass(part)}`}
              >
                {part}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <div
      draggable={draggable}
      onDragStart={(event) => {
        if (draggable) {
          event.dataTransfer.setData("text/plain", exercise.id);
        }
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className={`rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
        compact ? "px-2.5 py-2.5" : "px-3 py-3"
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${className}`}
      style={{
        borderColor: "rgba(15,23,42,0.08)",
        borderLeftWidth: 4,
        borderLeftColor: accent,
      }}
    >
      <div className={`flex items-start gap-3 ${trailing ? "justify-between" : ""}`}>
        {onMainClick ? (
          <button type="button" onClick={onMainClick} className="flex min-w-0 flex-1 items-start gap-3 text-left">
            {mainContent}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-3">{mainContent}</div>
        )}

        {trailing ? (
          <div className="flex shrink-0 items-center gap-2">{trailing}</div>
        ) : (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {onToggleFavorite ? (
              <button
                type="button"
                onClick={onToggleFavorite}
                className={`rounded-lg border p-1.5 transition ${
                  isFavorite ? "border-transparent motus-brand-fill" : "border-slate-200 text-slate-400 hover:text-amber-500"
                }`}
                aria-label={isFavorite ? "Fjern favoritt" : "Legg til favoritt"}
              >
                <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
              </button>
            ) : null}
            {showAddButton && onAdd ? (
              <button
                type="button"
                disabled={added}
                onClick={onAdd}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  added
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                    : "motus-brand-surface hover:bg-teal-100"
                }`}
              >
                {added ? (
                  "Lagt til"
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> Legg til
                  </span>
                )}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

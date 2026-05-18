import { Link2, Unlink } from "lucide-react";
import {
  EXERCISE_BLOCK_LABELS,
  countExercisesInBlock,
  isFirstExerciseInBlock,
  linkProgramExercisesAsBlock,
  unlinkProgramExerciseBlock,
  type ExerciseBlockType,
} from "../app/programBlocks";
import type { ProgramExercise } from "../app/types";
import { OutlineButton } from "../app/ui";

type ProgramExerciseBlockActionsProps = {
  exercises: ProgramExercise[];
  index: number;
  onChange: (next: ProgramExercise[]) => void;
};

export function ProgramExerciseBlockActions({ exercises, index, onChange }: ProgramExerciseBlockActionsProps) {
  const exercise = exercises[index];
  if (!exercise) return null;

  const inBlock = Boolean(exercise.blockId?.trim() && exercise.blockType);
  const isBlockStart = inBlock && isFirstExerciseInBlock(exercises, index);
  const blockSize = inBlock && exercise.blockId ? countExercisesInBlock(exercises, exercise.blockId) : 0;

  function applyBlock(count: number, blockType: ExerciseBlockType) {
    onChange(linkProgramExercisesAsBlock(exercises, index, count, blockType));
  }

  if (inBlock && isBlockStart) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-teal-200/80 bg-teal-50/60 px-2.5 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">
          {EXERCISE_BLOCK_LABELS[exercise.blockType!]} · {blockSize} øvelser
        </span>
        <OutlineButton
          type="button"
          className="!min-h-7 !px-2 !py-1 !text-[10px]"
          onClick={() => onChange(unlinkProgramExerciseBlock(exercises, exercise.blockId!))}
        >
          <Unlink className="h-3 w-3" aria-hidden />
          Løsne blokk
        </OutlineButton>
      </div>
    );
  }

  if (inBlock && !isBlockStart) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {index + 1 < exercises.length ? (
        <OutlineButton type="button" className="!min-h-7 !px-2 !py-1 !text-[10px]" onClick={() => applyBlock(2, "superset")}>
          <Link2 className="h-3 w-3" aria-hidden />
          Supersett med neste
        </OutlineButton>
      ) : null}
      {index + 2 < exercises.length ? (
        <OutlineButton type="button" className="!min-h-7 !px-2 !py-1 !text-[10px]" onClick={() => applyBlock(3, "triset")}>
          <Link2 className="h-3 w-3" aria-hidden />
          Trisett (3 stk)
        </OutlineButton>
      ) : null}
      {index + 1 < exercises.length ? (
        <OutlineButton
          type="button"
          className="!min-h-7 !px-2 !py-1 !text-[10px]"
          onClick={() => {
            const end = exercises.findIndex((item, itemIndex) => itemIndex > index && !item.blockId);
            const count = end > index ? end - index : exercises.length - index;
            onChange(linkProgramExercisesAsBlock(exercises, index, Math.max(2, count), "circuit"));
          }}
        >
          <Link2 className="h-3 w-3" aria-hidden />
          Sirkel fra her
        </OutlineButton>
      ) : null}
    </div>
  );
}

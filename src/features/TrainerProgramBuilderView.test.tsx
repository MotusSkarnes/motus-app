import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrainerProgramBuilderView } from "./TrainerProgramBuilderView";
import type { Exercise } from "../app/types";

const strengthExercise: Exercise = {
  id: "e1",
  name: "Knebøy",
  category: "Styrke",
  group: "Bein",
  equipment: "Stang",
  level: "Nybegynner",
  description: "",
};

describe("TrainerProgramBuilderView", () => {
  it("adds a dragged library exercise only once when dropped on the dropzone", () => {
    const onAddExercise = vi.fn();

    render(
      <TrainerProgramBuilderView
        programsSubTab="strength"
        onProgramsSubTabChange={vi.fn()}
        templateProgramTitle=""
        onTemplateProgramTitleChange={vi.fn()}
        programFormImageUrl=""
        onProgramFormImageUrlChange={vi.fn()}
        onProgramImageUpload={vi.fn()}
        isUploadingProgramImage={false}
        programExercisesDraft={[]}
        editingTemplateProgramId={null}
        exercises={[strengthExercise]}
        exercisesById={new Map([[strengthExercise.id, strengthExercise]])}
        visibleProgramExercises={[strengthExercise]}
        favoriteExerciseIds={[]}
        programExerciseSearch=""
        onProgramExerciseSearchChange={vi.fn()}
        exercisePopularityScores={new Map()}
        isDraftDropZoneActive={false}
        onDraftDropZoneActiveChange={vi.fn()}
        draggedExerciseIdFromLibrary={strengthExercise.id}
        onDraggedExerciseIdFromLibraryChange={vi.fn()}
        draggedDraftExerciseId={null}
        onDraggedDraftExerciseIdChange={vi.fn()}
        dragOverDraftExerciseId={null}
        onDragOverDraftExerciseIdChange={vi.fn()}
        onAddExercise={onAddExercise}
        onMoveDraftExercise={vi.fn()}
        onUpdateDraftExercise={vi.fn()}
        onRemoveDraftExercise={vi.fn()}
        onProgramExercisesDraftChange={vi.fn()}
        onSaveTemplate={vi.fn()}
        onResetTemplate={vi.fn()}
        getExercisePreviewSrc={() => ""}
        getExerciseSketchDataUri={() => ""}
        onToggleFavorite={vi.fn()}
        activeTemplatePrograms={[]}
        expandedTemplateProgramId={null}
        onExpandedTemplateProgramIdChange={vi.fn()}
        onStartEditTemplate={vi.fn()}
        onDeleteTemplate={vi.fn()}
        assignTemplateSection={null}
      />,
    );

    fireEvent.drop(screen.getByText(/Dra og slipp/i));

    expect(onAddExercise).toHaveBeenCalledTimes(1);
    expect(onAddExercise).toHaveBeenCalledWith(strengthExercise);
  });
});

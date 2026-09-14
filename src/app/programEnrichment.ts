import { enrichProgramWithActivityTemplateKind } from "./activityTemplate";
import { enrichProgramWithConditioningMode } from "./conditioningProgramMode";
import { tidyInspirationRunningProgram } from "./inspirationRunningPlans";
import { enrichProgramWithTrainingGroup } from "./trainingGroupProgram";
import type { TrainingProgram } from "./types";

export function enrichTrainingProgram(program: TrainingProgram): TrainingProgram {
  return tidyInspirationRunningProgram(
    enrichProgramWithConditioningMode(
      enrichProgramWithActivityTemplateKind(enrichProgramWithTrainingGroup(program)),
    ),
  );
}

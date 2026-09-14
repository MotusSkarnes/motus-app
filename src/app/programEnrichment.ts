import { enrichProgramWithActivityTemplateKind } from "./activityTemplate";
import { enrichProgramWithConditioningMode } from "./conditioningProgramMode";
import { enrichProgramWithTrainingGroup } from "./trainingGroupProgram";
import type { TrainingProgram } from "./types";

export function enrichTrainingProgram(program: TrainingProgram): TrainingProgram {
  return enrichProgramWithConditioningMode(
    enrichProgramWithActivityTemplateKind(enrichProgramWithTrainingGroup(program)),
  );
}

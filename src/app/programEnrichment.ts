import { enrichProgramWithActivityTemplateKind } from "./activityTemplate";
import { enrichProgramWithConditioningMode } from "./conditioningProgramMode";
import type { TrainingProgram } from "./types";

export function enrichTrainingProgram(program: TrainingProgram): TrainingProgram {
  return enrichProgramWithConditioningMode(enrichProgramWithActivityTemplateKind(program));
}

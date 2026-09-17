import { recipePeopleLabel } from "../app/recipeBody";

type RecipeServingsStepperProps = {
  value: number;
  onChange: (value: number) => void;
  baseServings: number;
  min?: number;
  max?: number;
  disabled?: boolean;
};

export function RecipeServingsStepper({
  value,
  onChange,
  baseServings,
  min = 1,
  max = 24,
  disabled = false,
}: RecipeServingsStepperProps) {
  const safeValue = Math.min(max, Math.max(min, value));

  return (
    <section className="motus-recipe-servings" aria-label="Antall porsjoner">
      <div className="motus-recipe-servings__copy">
        <h3>Antall porsjoner</h3>
        <p>
          Måltidet er skrevet for {recipePeopleLabel(baseServings)}. Endre antallet — mengdene oppdateres.
          Næringsinnhold per porsjon er det samme.
        </p>
      </div>
      <div className="motus-recipe-servings__stepper" role="group" aria-label="Velg antall porsjoner">
        <button
          type="button"
          className="motus-recipe-servings__btn"
          onClick={() => onChange(Math.max(min, safeValue - 1))}
          disabled={disabled || safeValue <= min}
          aria-label="Færre porsjoner"
        >
          −
        </button>
        <span className="motus-recipe-servings__value" aria-live="polite">
          {recipePeopleLabel(safeValue)}
        </span>
        <button
          type="button"
          className="motus-recipe-servings__btn"
          onClick={() => onChange(Math.min(max, safeValue + 1))}
          disabled={disabled || safeValue >= max}
          aria-label="Flere porsjoner"
        >
          +
        </button>
      </div>
    </section>
  );
}

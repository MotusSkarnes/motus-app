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
    <section className="motus-recipe-servings" aria-label="Antall personer">
      <div className="motus-recipe-servings__copy">
        <h3>Lage til</h3>
        <p>
          Oppskriften er skrevet for {recipePeopleLabel(baseServings)}. Velg hvor mange du skal lage til — mengdene
          oppdateres automatisk.
        </p>
      </div>
      <div className="motus-recipe-servings__stepper" role="group" aria-label="Velg antall personer">
        <button
          type="button"
          className="motus-recipe-servings__btn"
          onClick={() => onChange(Math.max(min, safeValue - 1))}
          disabled={disabled || safeValue <= min}
          aria-label="Færre personer"
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
          aria-label="Flere personer"
        >
          +
        </button>
      </div>
    </section>
  );
}

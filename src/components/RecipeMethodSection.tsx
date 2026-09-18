import { ListOrdered } from "lucide-react";
import { extractRecipeMethodSteps, extractRecipeTipsSection } from "../app/recipeBody";

type RecipeMethodSectionProps = {
  body: string;
};

export function RecipeMethodSection({ body }: RecipeMethodSectionProps) {
  const steps = extractRecipeMethodSteps(body);
  const tips = extractRecipeTipsSection(body);
  if (!steps.length && !tips) return null;

  return (
    <section className="motus-recipe-method" aria-label="Slik gjør du">
      {steps.length > 0 ? (
        <>
          <div className="motus-recipe-method__head">
            <span className="motus-recipe-method__icon" aria-hidden>
              <ListOrdered className="h-4 w-4" />
            </span>
            <h3>Slik gjør du</h3>
          </div>
          <ol className="motus-recipe-method__steps">
            {steps.map((step, index) => (
              <li key={`${index}-${step.slice(0, 24)}`} aria-label={`Steg ${index + 1}`}>
                <span className="motus-recipe-method__num" aria-hidden>
                  {index + 1}
                </span>
                <p className="motus-recipe-method__text">{step}</p>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      {tips ? (
        <p className="motus-recipe-method__tips">
          <strong>Tips: </strong>
          {tips}
        </p>
      ) : null}
    </section>
  );
}

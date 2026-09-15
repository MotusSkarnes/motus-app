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
          <h3>Slik gjør du</h3>
          <ol>
            {steps.map((step, index) => (
              <li key={`${index}-${step.slice(0, 24)}`}>{step}</li>
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

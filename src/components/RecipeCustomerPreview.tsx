import type { FoodItem } from "../app/foodBankTypes";
import { recipePeopleLabel, type RecipeIngredientDraft } from "../app/recipeBody";
import { TextInput } from "../app/ui";
import { RecipeMethodSection } from "./RecipeMethodSection";

type RecipeCustomerPreviewProps = {
  ingredients: RecipeIngredientDraft[];
  servings: number;
  body: string;
  foodItems: FoodItem[];
  onNameChange: (id: string, name: string) => void;
};

function amountLabel(row: RecipeIngredientDraft): string {
  return [row.quantity.trim(), row.unit.trim()].filter(Boolean).join(" ");
}

export function RecipeCustomerPreview({
  ingredients,
  servings,
  body,
  foodItems,
  onNameChange,
}: RecipeCustomerPreviewProps) {
  const rows = ingredients.filter((row) => row.quantity.trim() || row.unit.trim() || row.name.trim());
  if (!rows.length) return null;

  return (
    <section className="motus-recipe-customer-preview" aria-label="Slik ser kunden det">
      <div className="motus-recipe-customer-preview__head">
        <h3>Slik ser kunden det</h3>
        <p>
          Dette er listen medlemmet får opp. Klikk i et navn for å korte det ned — mengde og næringsinnhold følger
          fortsatt matvaren du valgte i banken.
        </p>
      </div>
      <section className="motus-recipe-ingredients" aria-label="Ingredienser med mengder">
        <div className="motus-recipe-ingredients-head">
          <h3 className="text-sm font-semibold text-slate-900">Ingredienser</h3>
          <span className="text-xs text-slate-500">{recipePeopleLabel(servings)}</span>
        </div>
        <ul className="motus-recipe-ingredient-list">
          {rows.map((row) => {
            const bankName = row.foodId ? foodItems.find((item) => item.id === row.foodId)?.name : undefined;
            const amount = amountLabel(row);
            return (
              <li key={row.id} className="motus-recipe-ingredient-row motus-recipe-customer-preview__row">
                {amount ? <span className="motus-recipe-ingredient-amount">{amount}</span> : null}
                <div className="motus-recipe-customer-preview__name">
                  <TextInput
                    className="motus-recipe-ingredient-name-input"
                    value={row.name}
                    onChange={(event) => onNameChange(row.id, event.target.value)}
                    aria-label={`Navn kunden ser${row.name.trim() ? ` for ${row.name.trim()}` : ""}`}
                    autoComplete="off"
                  />
                  {bankName && bankName.trim() !== row.name.trim() ? (
                    <span className="motus-recipe-ingredient-source">I matvarebanken: {bankName}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <RecipeMethodSection body={body} />
    </section>
  );
}

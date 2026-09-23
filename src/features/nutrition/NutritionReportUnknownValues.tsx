import { useMemo, useState } from "react";
import type { UnknownNutrientRow } from "../../app/nutritionReportUnknownValues";
import { filterUnknownNutrientRows } from "../../app/nutritionReportUnknownValues";
import { TextInput } from "../../app/ui";

export function NutritionReportUnknownValues({ rows }: { rows: UnknownNutrientRow[] }) {
  const [query, setQuery] = useState("");
  const visibleRows = useMemo(() => filterUnknownNutrientRows(rows, query), [query, rows]);

  return (
    <section className="motus-nutrition-unknown" aria-label="Ukjente næringsverdier">
      <h3 className="motus-nutrition-report-modal__subheading">Ukjente næringsverdier</h3>
      <p className="motus-nutrition-report-modal__footnote">
        Viser hvilke matvarer som hindrer 100 % datadekning for hvert næringsstoff. 0 regnes som en kjent verdi;
        tomt felt regnes som ukjent.
      </p>
      <TextInput
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Søk etter matvare eller næringsstoff…"
        aria-label="Søk i ukjente næringsverdier"
      />
      {visibleRows.length ? (
        <div className="motus-nutrition-unknown__list">
          {visibleRows.map((row) => (
            <article key={row.id} className="motus-nutrition-unknown__row">
              <header className="motus-nutrition-unknown__head">
                <strong>{row.label}</strong>
                <span>{row.percent}% kjent · {row.known} av {row.total} matvarer</span>
              </header>
              <div className="motus-nutrition-unknown__foods">
                {row.missingNames.map((name) => <span key={name}>{name}</span>)}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="motus-nutrition-unknown__empty">
          {rows.length ? "Ingen treff i rapporten." : "Alle viste næringsstoffer har 100 % kjente verdier."}
        </p>
      )}
    </section>
  );
}

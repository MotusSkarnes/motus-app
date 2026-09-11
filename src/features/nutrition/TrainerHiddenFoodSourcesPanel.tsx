import { restoreHiddenFoodSource } from "../../app/foodSourceHiddenStorage";
import { useHiddenFoodSources } from "../../app/useHiddenFoodSources";
import { OutlineButton } from "../../app/ui";

export function TrainerHiddenFoodSourcesPanel() {
  const hidden = useHiddenFoodSources();

  return (
    <section className="motus-foodbank-hidden-sources" aria-label="Skjulte matkilder">
      <p className="motus-foodbank-subtitle">
        Matvarer du har fjernet fra <strong>Gode matkilder</strong> i næringsrapporten. De ligger fortsatt i
        matbanken, men vises ikke i topp 10.
      </p>
      {hidden.length === 0 ? (
        <p className="motus-foodbank-empty">Ingen matvarer er skjult fra listen ennå.</p>
      ) : (
        <ul className="motus-foodbank-hidden-list">
          {hidden.map((row) => (
            <li key={row.nameKey}>
              <span>{row.name}</span>
              <OutlineButton type="button" className="text-xs" onClick={() => restoreHiddenFoodSource(row.nameKey)}>
                Hent tilbake
              </OutlineButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

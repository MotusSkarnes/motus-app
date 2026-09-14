import type { DailyVariationGroupId, DailyVariationTable } from "../../app/nutritionReportDailyVariation";

type NutritionReportDailyVariationProps = {
  table: DailyVariationTable;
  group: DailyVariationGroupId;
  onGroupChange: (group: DailyVariationGroupId) => void;
};

export function NutritionReportDailyVariation({
  table,
  group,
  onGroupChange,
}: NutritionReportDailyVariationProps) {
  return (
    <section className="motus-nutrition-variation" aria-label="Dagsvariasjon">
      <h3 className="motus-nutrition-report-modal__subheading">Dagsvariasjon</h3>
      <p className="motus-nutrition-report-modal__footnote">
        Enkel oversikt over dagene i perioden. Tallet under navnet er anbefalt dagsinntak. Fargen viser avvik fra
        periodens snitt.
      </p>
      <div className="motus-nutrition-report-modal__chips" role="group" aria-label="Næringsstoffer i dagsvariasjon">
        <button
          type="button"
          className={`motus-nutrition-report-modal__chip ${group === "macro" ? "is-active" : ""}`}
          onClick={() => onGroupChange("macro")}
        >
          Energi og makro
        </button>
        <button
          type="button"
          className={`motus-nutrition-report-modal__chip ${group === "micro" ? "is-active" : ""}`}
          onClick={() => onGroupChange("micro")}
        >
          Vitaminer og mineraler
        </button>
      </div>
      <div className="motus-nutrition-variation__scroll">
        <table className="motus-nutrition-variation__table">
          <thead>
            <tr>
              <th scope="col">Dag</th>
              {table.columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  title={column.targetLabel ? `${column.label} (${column.targetLabel})` : column.label}
                >
                  <span className="motus-nutrition-variation__col-name">{column.label}</span>
                  {column.targetLabel ? (
                    <span className="motus-nutrition-variation__col-ref">{column.targetLabel}</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.dateKey}>
                <th scope="row">{row.dayLabel}</th>
                {row.cells.map((cell) => (
                  <td key={cell.columnId} className={`motus-nutrition-variation__cell is-${cell.tone}`}>
                    <span className="motus-nutrition-variation__value">{cell.display}</span>
                    <span className="motus-nutrition-variation__bar" aria-hidden="true">
                      <i style={{ width: `${cell.barPct}%` }} />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Snitt</th>
              {table.averageCells.map((cell) => (
                <td key={cell.columnId}>{cell.display}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="motus-nutrition-variation__legend">
        <span className="is-low">Gul = under snitt</span>
        <span className="is-near">Teal = nær snitt</span>
        <span className="is-high">Rosa = over snitt</span>
      </p>
    </section>
  );
}

import type { NutrientContributionId } from "./nutritionReportContributors";
import type { NutrientCoverageLookup } from "./nutritionReportCoverage";

export type NutrientLabel = {
  id?: NutrientContributionId;
  label: string;
};

export type UnknownNutrientRow = {
  id: NutrientContributionId;
  label: string;
  known: number;
  total: number;
  percent: number;
  missingNames: string[];
};

export function buildUnknownNutrientRows(
  coverageLookup: NutrientCoverageLookup,
  labels: NutrientLabel[],
): UnknownNutrientRow[] {
  const labelById = new Map<NutrientContributionId, string>();
  for (const row of labels) {
    if (row.id && !labelById.has(row.id)) labelById.set(row.id, row.label);
  }

  const rows: UnknownNutrientRow[] = [];
  for (const [id, label] of labelById) {
    const coverage = coverageLookup[id];
    if (!coverage || coverage.total <= 0 || coverage.percent >= 100 || coverage.missingNames.length === 0) continue;
    rows.push({
      id,
      label,
      known: coverage.known,
      total: coverage.total,
      percent: coverage.percent,
      missingNames: [...new Set(coverage.missingNames)].sort((a, b) => a.localeCompare(b, "nb")),
    });
  }
  return rows.sort((a, b) => a.percent - b.percent || a.label.localeCompare(b.label, "nb"));
}

export function filterUnknownNutrientRows(rows: UnknownNutrientRow[], query: string): UnknownNutrientRow[] {
  const normalized = query.trim().toLocaleLowerCase("nb");
  if (!normalized) return rows;
  return rows.filter((row) =>
    [row.label, ...row.missingNames].some((value) => value.toLocaleLowerCase("nb").includes(normalized)),
  );
}

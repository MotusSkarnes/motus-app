import { useMemo, useRef, useState } from "react";
import { Download, Loader2, Upload, X } from "lucide-react";
import {
  buildMatvaretabellenImportDiagnostics,
  downloadFoodImportTemplate,
  fetchMatvaretabellenFoods,
  filterMatvaretabellenFoods,
  mapMatvaretabellenFood,
  mergeFoodImports,
  parseFoodImportText,
  type MatvaretabellenFood,
  type FoodImportMergeMode,
} from "../app/foodBankImport";
import type { FoodItem } from "../app/foodBankTypes";
import { GradientButton, OutlineButton, TextInput } from "../app/ui";
import "../foodbank.css";

const MAX_FILE_IMPORT = 500;

type FoodBankImportModalProps = {
  trainerName: string;
  existingItems: FoodItem[];
  onClose: () => void;
  onImported: (items: FoodItem[], summary: string) => void;
};

export function FoodBankImportModal({ trainerName, existingItems, onClose, onImported }: FoodBankImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"file" | "matvaretabellen">("file");
  const [mergeMode, setMergeMode] = useState<FoodImportMergeMode>("update");
  const [filePreview, setFilePreview] = useState<{ count: number; errors: string[] } | null>(null);
  const [pendingFileItems, setPendingFileItems] = useState<FoodItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiFoods, setApiFoods] = useState<MatvaretabellenFood[] | null>(null);
  const [apiQuery, setApiQuery] = useState("");

  const apiMatches = useMemo(() => {
    if (!apiFoods) return [];
    return filterMatvaretabellenFoods(apiFoods, apiQuery);
  }, [apiFoods, apiQuery]);
  const apiDiagnostics = useMemo(
    () =>
      apiFoods
        ? buildMatvaretabellenImportDiagnostics(apiFoods, trainerName, apiQuery)
        : null,
    [apiFoods, trainerName, apiQuery],
  );

  const readFile = async (file: File) => {
    setStatus(null);
    const text = await file.text();
    const parsed = parseFoodImportText(text, file.name, trainerName);
    const limited = parsed.items.slice(0, MAX_FILE_IMPORT);
    setPendingFileItems(limited);
    setFilePreview({
      count: limited.length,
      errors: [
        ...parsed.errors,
        ...(parsed.items.length > MAX_FILE_IMPORT
          ? [`Viser første ${MAX_FILE_IMPORT} av ${parsed.items.length} rader.`]
          : []),
      ],
    });
  };

  const importFileItems = () => {
    if (!pendingFileItems.length) {
      setStatus("Ingen matvarer å importere. Velg en fil først.");
      return;
    }
    const merged = mergeFoodImports(existingItems, pendingFileItems, mergeMode);
    onImported(
      merged.items,
      `Import fullført: ${merged.added} nye, ${merged.updated} oppdatert, ${merged.skipped} hoppet over (duplikat).`,
    );
    onClose();
  };

  const loadMatvaretabellen = async () => {
    setApiLoading(true);
    setStatus(null);
    try {
      const foods = await fetchMatvaretabellenFoods();
      setApiFoods(foods);
      const diagnostics = buildMatvaretabellenImportDiagnostics(foods, trainerName, apiQuery);
      setStatus(
        `Hentet ${diagnostics.totalRows} rader. Av disse er ${diagnostics.mappableRows} gyldige for import i nåværende visning og ${diagnostics.droppedRows} droppes (mangler data/navn).`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke hente fra Matvaretabellen.");
    } finally {
      setApiLoading(false);
    }
  };

  const importFromMatvaretabellen = () => {
    if (!apiFoods) {
      setStatus("Hent matvarer fra Matvaretabellen først.");
      return;
    }
    const imported = apiMatches
      .map((food) => mapMatvaretabellenFood(food, trainerName))
      .filter((row): row is FoodItem => row !== null);
    if (!imported.length) {
      setStatus("Ingen matvarer matcher søket.");
      return;
    }
    const merged = mergeFoodImports(existingItems, imported, mergeMode);
    onImported(
      merged.items,
      `Matvaretabellen: ${merged.added} nye, ${merged.updated} oppdatert, ${merged.skipped} hoppet over.`,
    );
    onClose();
  };

  return (
    <div className="motus-foodbank-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="motus-foodbank-modal motus-foodbank-modal--wide motus-foodbank-import-modal"
        role="dialog"
        aria-labelledby="food-import-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="motus-foodbank-modal-head">
          <h2 id="food-import-title">Importer matvarer</h2>
          <button type="button" className="motus-foodbank-icon-btn" onClick={onClose} aria-label="Lukk">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="motus-foodbank-import-tabs" role="tablist">
          <button type="button" className={tab === "file" ? "is-active" : ""} onClick={() => setTab("file")}>
            Fil (CSV / JSON)
          </button>
          <button type="button" className={tab === "matvaretabellen" ? "is-active" : ""} onClick={() => setTab("matvaretabellen")}>
            Matvaretabellen
          </button>
        </div>

        <div className="motus-foodbank-modal-body">
          <fieldset className="motus-foodbank-import-merge">
            <legend className="motus-foodbank-field-label">Hvis matvaren finnes fra før</legend>
            <label className="motus-foodbank-check">
              <input
                type="radio"
                name="merge-mode"
                checked={mergeMode === "update"}
                onChange={() => setMergeMode("update")}
              />
              Oppdater eksisterende (anbefalt — ingen duplikater)
            </label>
            <label className="motus-foodbank-check">
              <input type="radio" name="merge-mode" checked={mergeMode === "skip"} onChange={() => setMergeMode("skip")} />
              Hopp over duplikater
            </label>
          </fieldset>

          {tab === "file" ? (
            <div className="motus-foodbank-import-panel">
              <p className="motus-foodbank-import-copy">
                Last opp CSV (semikolon) eller JSON. Matvaretabellen sin <code>foods.json</code> støttes også.
              </p>
              <div className="motus-foodbank-import-actions-row">
                <OutlineButton type="button" onClick={downloadFoodImportTemplate}>
                  <Download className="h-4 w-4" aria-hidden />
                  Last ned CSV-mal
                </OutlineButton>
                <OutlineButton type="button" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" aria-hidden />
                  Velg fil
                </OutlineButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) void readFile(file);
                    event.currentTarget.value = "";
                  }}
                />
              </div>
              {filePreview ? (
                <p className="motus-foodbank-import-preview">
                  <strong>{filePreview.count}</strong> matvarer klare til import.
                  {filePreview.errors.length ? (
                    <span className="motus-foodbank-import-errors">
                      {filePreview.errors.slice(0, 4).join(" ")}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="motus-foodbank-import-panel">
              <p className="motus-foodbank-import-copy">
                Henter åpne data fra Matvaretabellen (Mattilsynet). Du kan importere alle treff i én runde.
              </p>
              <OutlineButton type="button" onClick={() => void loadMatvaretabellen()} disabled={apiLoading}>
                {apiLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
                {apiLoading ? "Henter…" : "Hent fra Matvaretabellen"}
              </OutlineButton>
              {apiFoods ? (
                <label className="motus-foodbank-field">
                  <span className="motus-foodbank-field-label">Filtrer før import</span>
                  <TextInput
                    value={apiQuery}
                    onChange={(event) => setApiQuery(event.target.value)}
                    placeholder="f.eks. kylling laks havregryn"
                  />
                  <span className="motus-foodbank-import-preview">
                    {apiDiagnostics
                      ? apiQuery.trim()
                        ? `${apiDiagnostics.filteredRows} treff totalt. ${apiDiagnostics.mappableRows} kan importeres nå, ${apiDiagnostics.droppedRows} droppes.`
                        : `Alle ${apiDiagnostics.totalRows} rader. ${apiDiagnostics.mappableRows} kan importeres nå, ${apiDiagnostics.droppedRows} droppes.`
                      : `Alle ${apiFoods.length} matvarer — skriv søkeord for å begrense`}
                  </span>
                </label>
              ) : null}
            </div>
          )}

          {status ? <p className="motus-foodbank-form-status">{status}</p> : null}
        </div>

        <div className="motus-foodbank-modal-actions">
          <OutlineButton onClick={onClose}>Avbryt</OutlineButton>
          {tab === "file" ? (
            <GradientButton onClick={importFileItems} disabled={!pendingFileItems.length}>
              Importer fra fil
            </GradientButton>
          ) : (
            <GradientButton onClick={importFromMatvaretabellen} disabled={!apiFoods || apiLoading}>
              Importer{apiDiagnostics ? ` (${apiDiagnostics.importRows})` : apiQuery.trim() ? ` (${apiMatches.length})` : ""}
            </GradientButton>
          )}
        </div>
      </div>
    </div>
  );
}

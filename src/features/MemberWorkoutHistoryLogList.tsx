import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { isActivityWorkoutLog, isGroupWorkoutLog } from "../app/activityWorkoutLog";
import { periodPlanStartDateForDateInput } from "../app/dateFormat";
import { isHoldBasedExerciseCategory } from "../app/exerciseCategories";
import { formatWorkoutResultPerformedLabel } from "../app/programExercisePresentation";
import type { WorkoutLog, WorkoutReflection } from "../app/types";
import type { UpdateWorkoutLogDateInput } from "../services/appRepository";
import { EmptyState, TextInput } from "../app/ui";
import { MemberSimpleWorkoutLogDetails } from "./MemberSimpleWorkoutLogDetails";

function groupLoggedResultsForDisplay(results: NonNullable<WorkoutLog["results"]>): Array<{
  key: string;
  exerciseName: string;
  exerciseNote: string;
  rows: Array<{ result: NonNullable<WorkoutLog["results"]>[number]; originalIndex: number }>;
}> {
  const groups = new Map<
    string,
    {
      key: string;
      exerciseName: string;
      exerciseNote: string;
      rows: Array<{ result: NonNullable<WorkoutLog["results"]>[number]; originalIndex: number }>;
    }
  >();
  results.forEach((result, originalIndex) => {
    const key = `${result.programExerciseId || result.exerciseId || result.exerciseName.trim().toLowerCase()}::${result.exerciseName.trim().toLowerCase()}`;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push({ result, originalIndex });
      if (!existing.exerciseNote && result.exerciseNote?.trim()) {
        existing.exerciseNote = result.exerciseNote.trim();
      }
      return;
    }
    groups.set(key, {
      key,
      exerciseName: result.exerciseName.trim() || "Øvelse",
      exerciseNote: result.exerciseNote?.trim() ?? "",
      rows: [{ result, originalIndex }],
    });
  });
  return Array.from(groups.values());
}

function isPeriodPlanWorkoutLog(log: WorkoutLog): boolean {
  const note = log.note?.trim().toLowerCase() ?? "";
  return note.includes("periodeplan");
}

export type EditingLoggedExerciseDraft = {
  performedWeight: string;
  performedReps: string;
  performedDurationMinutes: string;
  performedSpeed: string;
  performedIncline: string;
  completed: boolean;
};

export type MemberWorkoutHistoryLogListProps = {
  logs: WorkoutLog[];
  expandedLogId: string | null;
  onToggleExpanded: (logId: string) => void;
  focusLogId?: string | null;
  lastDeletedMessage?: boolean;
  onUndoDelete?: () => void;
  editingKey: string | null;
  editingDraft: EditingLoggedExerciseDraft | null;
  onStartEdit: (logId: string, result: NonNullable<WorkoutLog["results"]>[number], index: number) => void;
  onSaveEdit: (logId: string, index: number) => void;
  onCancelEdit: () => void;
  onDeleteExercise: (logId: string, exerciseId: string) => void;
  onDraftChange: (updater: (prev: EditingLoggedExerciseDraft | null) => EditingLoggedExerciseDraft | null) => void;
  onUpdateWorkoutLogDate?: (input: UpdateWorkoutLogDateInput) => void;
  onUpdateActivityWorkout?: (input: {
    logId: string;
    activityName: string;
    durationMinutes: string;
    note: string;
    reflection: WorkoutReflection;
    photoUrl?: string;
    removePhoto?: boolean;
  }) => void;
  onUpdateGroupWorkoutLog?: (input: {
    logId: string;
    className: string;
    note: string;
    reflection: WorkoutReflection;
  }) => void;
  onDeleteWorkoutLog?: (logId: string, title: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function MemberWorkoutHistoryLogList({
  logs,
  expandedLogId,
  onToggleExpanded,
  focusLogId,
  lastDeletedMessage,
  onUndoDelete,
  editingKey,
  editingDraft,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDeleteExercise,
  onDraftChange,
  onUpdateWorkoutLogDate,
  onUpdateActivityWorkout,
  onUpdateGroupWorkoutLog,
  onDeleteWorkoutLog,
  emptyTitle = "Ingen økter logget ennå",
  emptyDescription = "Start en økt for å bygge historikk og fremgang.",
}: MemberWorkoutHistoryLogListProps) {
  const [editingSimpleLogId, setEditingSimpleLogId] = useState<string | null>(null);
  const [editingDateLogId, setEditingDateLogId] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState("");
  const [dateEditStatus, setDateEditStatus] = useState<string | null>(null);

  function saveWorkoutLogDate(input: UpdateWorkoutLogDateInput) {
    setDateEditStatus(null);
    onUpdateWorkoutLogDate?.({
      ...input,
      onPersisted: (result) => {
        if (!result.ok) {
          setDateEditStatus(result.message?.trim() || "Kunne ikke lagre dato i sky. Prøv igjen.");
        }
        input.onPersisted?.(result);
      },
    });
  }

  return (
    <div className="motus-member-history-log-list space-y-3">
      {lastDeletedMessage ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Øvelse slettet fra loggen.
          {onUndoDelete ? (
            <button type="button" onClick={onUndoDelete} className="ml-2 font-semibold underline">
              Angre
            </button>
          ) : null}
        </div>
      ) : null}
      {dateEditStatus ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {dateEditStatus}
        </div>
      ) : null}
      {logs.length === 0 ? (
        <EmptyState icon="🧾" title={emptyTitle} description={emptyDescription} className="bg-white" />
      ) : null}
      {logs.map((log) => {
        const isExpanded = expandedLogId === log.id;
        const fromPeriodPlan = isPeriodPlanWorkoutLog(log);
        const isFocused = focusLogId === log.id;
        const isSimpleLog = isActivityWorkoutLog(log) || isGroupWorkoutLog(log);
        const hasSetResults = (log.results ?? []).length > 0;
        return (
          <div
            key={log.id}
            id={`member-workout-log-${log.id}`}
            className={`motus-member-history-log-item overflow-hidden rounded-xl border bg-white ${isFocused ? "ring-2 ring-teal-400/80 ring-offset-1" : ""}`}
            style={{ borderColor: "rgba(15,23,42,0.08)" }}
          >
            <button
              type="button"
              onClick={() => onToggleExpanded(log.id)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{log.date}</div>
                <div className="truncate text-xs text-slate-500">{log.programTitle}</div>
              </div>
              <span className="shrink-0 text-[11px] font-semibold text-teal-700">{isExpanded ? "Skjul" : "Detaljer"}</span>
              <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition ${isExpanded ? "rotate-90" : ""}`} aria-hidden />
            </button>
            {!isExpanded && onUpdateWorkoutLogDate ? (
              <div className="border-t border-slate-100 px-3 py-2">
                {editingDateLogId === log.id ? (
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">Dato</span>
                      <TextInput type="date" value={dateDraft} onChange={(event) => setDateDraft(event.target.value)} />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        saveWorkoutLogDate({ logId: log.id, date: dateDraft });
                        setEditingDateLogId(null);
                      }}
                      disabled={!dateDraft}
                      className="rounded-lg border motus-brand-surface px-3 py-2 text-[11px] font-semibold text-emerald-700 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Lagre dato
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingDateLogId(null)}
                      className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-200"
                    >
                      Avbryt
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDateLogId(log.id);
                      setDateDraft(periodPlanStartDateForDateInput(log.date));
                    }}
                    className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-100"
                  >
                    Endre dato
                  </button>
                )}
              </div>
            ) : null}
            {isExpanded ? (
              <div className="space-y-2 border-t border-slate-100 px-3 pb-3 pt-2">
                {fromPeriodPlan && log.note ? (
                  <div className="rounded-lg border motus-brand-surface px-2.5 py-1.5 text-xs text-emerald-900">{log.note}</div>
                ) : null}
                {onUpdateWorkoutLogDate ? (
                  <div className="rounded-xl border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    {editingDateLogId === log.id ? (
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                        <label className="space-y-1">
                          <span className="text-xs font-medium text-slate-600">Dato</span>
                          <TextInput type="date" value={dateDraft} onChange={(event) => setDateDraft(event.target.value)} />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            saveWorkoutLogDate({ logId: log.id, date: dateDraft });
                            setEditingDateLogId(null);
                          }}
                          disabled={!dateDraft}
                          className="rounded-lg border motus-brand-surface px-3 py-2 text-[11px] font-semibold text-emerald-700 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Lagre dato
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDateLogId(null)}
                          className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-200"
                        >
                          Avbryt
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dato</div>
                          <div className="mt-0.5 text-sm font-medium text-slate-800">{log.date}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDateLogId(log.id);
                            setDateDraft(periodPlanStartDateForDateInput(log.date));
                          }}
                          className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-100"
                        >
                          Endre dato
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
                {!fromPeriodPlan && log.note ? <div className="text-sm text-slate-600">{log.note}</div> : null}
                {log.trainerComment ? (
                  <div className="rounded-lg border motus-brand-surface px-3 py-2 text-sm text-emerald-900">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Kommentar fra trener</div>
                    <div className="mt-1">{log.trainerComment}</div>
                  </div>
                ) : null}
                {isSimpleLog ? (
                  <MemberSimpleWorkoutLogDetails
                    log={log}
                    allowEdit={
                      (isActivityWorkoutLog(log) && Boolean(onUpdateActivityWorkout)) ||
                      (isGroupWorkoutLog(log) && Boolean(onUpdateGroupWorkoutLog))
                    }
                    isEditing={editingSimpleLogId === log.id}
                    onStartEdit={() => setEditingSimpleLogId(log.id)}
                    onCancelEdit={() => setEditingSimpleLogId(null)}
                    onSaveDate={(date, onPersisted) => saveWorkoutLogDate({ logId: log.id, date, onPersisted })}
                    onSaveActivity={(payload) => {
                      onUpdateActivityWorkout?.({ logId: log.id, ...payload });
                      setEditingSimpleLogId(null);
                    }}
                    onSaveGroup={(payload) => {
                      onUpdateGroupWorkoutLog?.({ logId: log.id, ...payload });
                      setEditingSimpleLogId(null);
                    }}
                    onDelete={
                      onDeleteWorkoutLog
                        ? () => onDeleteWorkoutLog(log.id, log.programTitle)
                        : undefined
                    }
                  />
                ) : null}
                {hasSetResults ? (
                <div className="rounded-xl border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Utført i økta</div>
                  <div className="mt-2 space-y-2">
                    {
                      groupLoggedResultsForDisplay(log.results ?? []).map((group) => (
                        <div
                          key={group.key}
                          className="rounded-lg border bg-white px-3 py-3 text-sm"
                          style={{ borderColor: "rgba(15,23,42,0.08)" }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-slate-800">{group.exerciseName}</div>
                              <div className="mt-0.5 text-[11px] text-slate-500">
                                {group.rows.length === 1 ? "1 sett logget" : `${group.rows.length} sett logget`}
                              </div>
                              {group.exerciseNote ? (
                                <div className="mt-1 text-xs text-slate-600 italic">«{group.exerciseNote}»</div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => onDeleteExercise(log.id, group.rows[0]?.result.exerciseId ?? "")}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                            >
                              Slett øvelse
                            </button>
                          </div>
                          <div className="mt-3 space-y-2">
                            {group.rows.map(({ result, originalIndex }) => {
                              const editKey = `${log.id}:${result.exerciseId}:${originalIndex}`;
                              const isEditing = editingKey === editKey && Boolean(editingDraft);
                              const setLabel = result.setNumber && result.setNumber > 0 ? `Sett ${result.setNumber}` : "Sett";
                              return (
                                <div
                                  key={`${group.key}:${originalIndex}`}
                                  className="rounded-lg border bg-slate-50 px-3 py-2"
                                  style={{ borderColor: "rgba(15,23,42,0.08)" }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="font-medium text-slate-700">{setLabel}</div>
                                    <div className="flex items-center gap-1.5">
                                      {isEditing ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => onSaveEdit(log.id, originalIndex)}
                                            className="rounded-lg border motus-brand-surface px-2 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-teal-100"
                                          >
                                            Lagre
                                          </button>
                                          <button
                                            type="button"
                                            onClick={onCancelEdit}
                                            className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-200"
                                          >
                                            Avbryt
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => onStartEdit(log.id, result, originalIndex)}
                                          className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-100"
                                        >
                                          Rediger sett
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {isEditing && editingDraft ? (
                                    <div className="mt-2 grid gap-2">
                                      {result.exerciseCategory === "Kondisjon" ? (
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                          <TextInput
                                            value={editingDraft.performedDurationMinutes}
                                            onChange={(e) =>
                                              onDraftChange((prev) =>
                                                prev ? { ...prev, performedDurationMinutes: e.target.value } : prev,
                                              )
                                            }
                                            placeholder="Minutter"
                                          />
                                          <TextInput
                                            value={editingDraft.performedSpeed}
                                            onChange={(e) =>
                                              onDraftChange((prev) => (prev ? { ...prev, performedSpeed: e.target.value } : prev))
                                            }
                                            placeholder="Km/t"
                                          />
                                          <TextInput
                                            value={editingDraft.performedIncline}
                                            onChange={(e) =>
                                              onDraftChange((prev) => (prev ? { ...prev, performedIncline: e.target.value } : prev))
                                            }
                                            placeholder="Incline %"
                                          />
                                        </div>
                                      ) : result.exerciseCategory && isHoldBasedExerciseCategory(result.exerciseCategory) ? (
                                        <div className="grid grid-cols-1 gap-2">
                                          <TextInput
                                            value={editingDraft.performedWeight}
                                            onChange={(e) =>
                                              onDraftChange((prev) => (prev ? { ...prev, performedWeight: e.target.value } : prev))
                                            }
                                            placeholder="Sekunder"
                                          />
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                          <TextInput
                                            value={editingDraft.performedWeight}
                                            onChange={(e) =>
                                              onDraftChange((prev) => (prev ? { ...prev, performedWeight: e.target.value } : prev))
                                            }
                                            placeholder="Kg"
                                          />
                                          <TextInput
                                            value={editingDraft.performedReps}
                                            onChange={(e) =>
                                              onDraftChange((prev) => (prev ? { ...prev, performedReps: e.target.value } : prev))
                                            }
                                            placeholder="Reps"
                                          />
                                        </div>
                                      )}
                                      <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={editingDraft.completed}
                                          onChange={(e) =>
                                            onDraftChange((prev) => (prev ? { ...prev, completed: e.target.checked } : prev))
                                          }
                                        />
                                        Markert som fullført
                                      </label>
                                    </div>
                                  ) : (
                                    <div className="mt-1 text-xs text-slate-600">
                                      Utført: {formatWorkoutResultPerformedLabel(result)}
                                      {result.completed ? " · Fullført" : " · Ikke markert fullført"}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
                ) : isSimpleLog ? null : (
                  <div className="text-sm text-slate-500">Ingen settdata registrert for denne økta.</div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  formatActivityDurationLabel,
  isActivityWorkoutLog,
  isGroupWorkoutLog,
  parseActivityNameFromLogTitle,
  parseGroupClassNameFromLogTitle,
  reflectionLevelToUi,
  workoutReflectionEmoji,
} from "../app/activityWorkoutLog";
import { periodPlanStartDateForDateInput } from "../app/dateFormat";
import { ReflectionLevelPicker } from "./ReflectionLevelPicker";
import { compressImageFile } from "../app/imageCompress";
import type { WorkoutLog, WorkoutReflection } from "../app/types";
import { GradientButton, TextArea, TextInput } from "../app/ui";
import { ActivityNameCombobox } from "./ActivityNameCombobox";

const MAX_ACTIVITY_PHOTO_CHARS = 420_000;

export type MemberSimpleWorkoutLogDetailsProps = {
  log: WorkoutLog;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveDate?: (date: string) => void;
  onSaveActivity: (payload: {
    activityName: string;
    durationMinutes: string;
    note: string;
    reflection: WorkoutReflection;
    photoUrl?: string;
    removePhoto?: boolean;
  }) => void;
  onSaveGroup: (payload: { className: string; note: string; reflection: WorkoutReflection }) => void;
  allowEdit?: boolean;
  onDelete?: () => void;
};

function ReflectionSummary({ reflection }: { reflection?: WorkoutReflection }) {
  if (!reflection) return null;
  return (
    <div className="text-xs text-slate-600">
      Følelse {workoutReflectionEmoji(reflectionLevelToUi(reflection.energyLevel))} · Belastning{" "}
      {workoutReflectionEmoji(reflectionLevelToUi(reflection.difficultyLevel))} · Motivasjon{" "}
      {workoutReflectionEmoji(reflectionLevelToUi(reflection.motivationLevel))}
    </div>
  );
}

export function MemberSimpleWorkoutLogDetails({
  log,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveDate,
  onSaveActivity,
  onSaveGroup,
  allowEdit = true,
  onDelete,
}: MemberSimpleWorkoutLogDetailsProps) {
  const isActivity = isActivityWorkoutLog(log);
  const isGroup = isGroupWorkoutLog(log);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activityName, setActivityName] = useState("");
  const [className, setClassName] = useState("");
  const [date, setDate] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [comment, setComment] = useState("");
  const [energyLevel, setEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [difficultyLevel, setDifficultyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [motivationLevel, setMotivationLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) return;
    const reflection = log.reflection;
    setEnergyLevel(reflection?.energyLevel ?? 3);
    setDifficultyLevel(reflection?.difficultyLevel ?? 3);
    setMotivationLevel(reflection?.motivationLevel ?? 3);
    const note = log.note?.trim() || reflection?.note?.trim() || "";
    setComment(note);
    setDate(periodPlanStartDateForDateInput(log.date));
    setRemovePhoto(false);
    setStatus(null);
    if (isActivity) {
      setActivityName(parseActivityNameFromLogTitle(log.programTitle));
      setDurationMinutes(String(log.activityDurationMinutes ?? "").trim() || "45");
      const existingPhoto = log.activityPhotoUrl ?? "";
      setPhotoPreview(existingPhoto);
      setPhotoDataUrl(existingPhoto);
    }
    if (isGroup) {
      setClassName(parseGroupClassNameFromLogTitle(log.programTitle));
    }
  }, [isEditing, isActivity, isGroup, log]);

  if (!isActivity && !isGroup) return null;

  async function handlePhotoChange(file: File | null) {
    if (!file) return;
    setIsUploadingPhoto(true);
    setStatus(null);
    try {
      const compressed = await compressImageFile(file, 960, 0.78);
      if (compressed.length > MAX_ACTIVITY_PHOTO_CHARS) {
        setPhotoPreview("");
        setPhotoDataUrl("");
        setStatus("Bildet ble for stort. Prøv et annet bilde.");
        return;
      }
      setPhotoPreview(compressed);
      setPhotoDataUrl(compressed);
      setRemovePhoto(false);
    } catch {
      setStatus("Kunne ikke lese bildet.");
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  function buildReflection(): WorkoutReflection {
    return {
      energyLevel,
      difficultyLevel,
      motivationLevel,
      note: comment.trim(),
    };
  }

  function handleSave() {
    setStatus(null);
    if (isActivity) {
      if (!activityName.trim()) {
        setStatus("Skriv inn aktivitet.");
        return;
      }
      const duration = Number(durationMinutes.trim().replace(",", "."));
      if (!Number.isFinite(duration) || duration <= 0) {
        setStatus("Skriv inn varighet i minutter.");
        return;
      }
      onSaveActivity({
        activityName: activityName.trim(),
        durationMinutes: String(Math.round(duration)),
        note: comment.trim(),
        reflection: buildReflection(),
        photoUrl: photoDataUrl || undefined,
        removePhoto: removePhoto && !photoDataUrl,
      });
      if (date && date !== periodPlanStartDateForDateInput(log.date)) {
        onSaveDate?.(date);
      }
      return;
    }
    if (!className.trim()) {
      setStatus("Skriv inn navn på gruppetime.");
      return;
    }
    onSaveGroup({
      className: className.trim(),
      note: comment.trim(),
      reflection: buildReflection(),
    });
    if (date && date !== periodPlanStartDateForDateInput(log.date)) {
      onSaveDate?.(date);
    }
  }

  if (!isEditing) {
    return (
      <div className="rounded-xl border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {isActivity ? "Aktivitet" : "Gruppetime"}
          </div>
          <div className="flex shrink-0 flex-wrap gap-1">
            {allowEdit ? (
              <button
                type="button"
                onClick={onStartEdit}
                className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-100"
              >
                Rediger
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                Slett
              </button>
            ) : null}
          </div>
        </div>
        {isActivity ? (
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            <div>
              <span className="font-medium">Aktivitet:</span> {parseActivityNameFromLogTitle(log.programTitle)}
            </div>
            {formatActivityDurationLabel(log.activityDurationMinutes) ? (
              <div>
                <span className="font-medium">Varighet:</span> {formatActivityDurationLabel(log.activityDurationMinutes)}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-2 text-sm text-slate-700">
            <span className="font-medium">Time:</span> {parseGroupClassNameFromLogTitle(log.programTitle)}
          </div>
        )}
        {log.note ? <div className="mt-2 text-sm text-slate-600">{log.note}</div> : null}
        <div className="mt-2">
          <ReflectionSummary reflection={log.reflection} />
        </div>
        {log.reflection?.note && log.reflection.note !== log.note ? (
          <div className="mt-1 text-xs text-slate-500">Til PT: {log.reflection.note}</div>
        ) : null}
        {log.activityPhotoUrl ? (
          <img src={log.activityPhotoUrl} alt="Aktivitet" className="mt-3 max-h-48 w-full rounded-xl object-cover" />
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-slate-50 p-3 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Rediger {isActivity ? "aktivitet" : "gruppetime"}
      </div>
      <label className="space-y-1">
        <span className="text-xs font-medium text-slate-600">Dato</span>
        <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      {isActivity ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Aktivitet</span>
            <ActivityNameCombobox value={activityName} onChange={setActivityName} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Varighet (min)</span>
            <TextInput
              type="number"
              min={1}
              max={600}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Bilde</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-700 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
              onChange={(event) => void handlePhotoChange(event.target.files?.[0] ?? null)}
            />
            {isUploadingPhoto ? <div className="text-xs text-slate-500">Behandler bilde…</div> : null}
            {photoPreview ? (
              <img src={photoPreview} alt="Forhåndsvisning" className="mt-2 max-h-36 w-full rounded-xl object-cover" />
            ) : null}
            {log.activityPhotoUrl || photoPreview ? (
              <button
                type="button"
                className="mt-1 text-xs font-semibold text-rose-700 underline"
                onClick={() => {
                  setPhotoPreview("");
                  setPhotoDataUrl("");
                  setRemovePhoto(true);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Fjern bilde
              </button>
            ) : null}
          </label>
        </div>
      ) : (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Gruppetime</span>
          <TextInput value={className} onChange={(event) => setClassName(event.target.value)} />
        </label>
      )}
      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-600">Kommentar</span>
        <TextArea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="min-h-[72px] !text-sm"
          placeholder="Hvordan gikk det?"
        />
      </label>
      <ReflectionLevelPicker question="Hvordan føles energinivået?" value={energyLevel} onChange={setEnergyLevel} />
      <ReflectionLevelPicker question="Hvor tung opplevdes økten?" value={difficultyLevel} onChange={setDifficultyLevel} />
      <ReflectionLevelPicker question="Hvordan er motivasjonen videre?" value={motivationLevel} onChange={setMotivationLevel} />
      <div className="flex flex-wrap items-center gap-2">
        <GradientButton type="button" onClick={handleSave} className="px-4 py-2 text-xs">
          Lagre endringer
        </GradientButton>
        <button
          type="button"
          onClick={onCancelEdit}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Avbryt
        </button>
        {status ? <div className="text-xs text-rose-700">{status}</div> : null}
      </div>
    </div>
  );
}

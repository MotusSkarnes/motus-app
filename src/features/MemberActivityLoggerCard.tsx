import { Footprints } from "lucide-react";
import { useRef, useState } from "react";
import { ACTIVITY_NAME_SUGGESTIONS } from "../app/activityWorkoutLog";
import { compressImageFile } from "../app/imageCompress";
import type { LogActivityWorkoutInput } from "../services/appRepository";
import { GradientButton, TextArea, TextInput, TrainingStartButton } from "../app/ui";

function toIsoDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const ACTIVITY_COVER_SRC = "/program-covers/kondisjon.png";
const MAX_ACTIVITY_PHOTO_CHARS = 420_000;

export type MemberActivityLoggerCardProps = {
  onLog: (input: LogActivityWorkoutInput) => void;
  memberId: string;
};

function getReflectionEmoji(level: 1 | 2 | 3 | 4 | 5): string {
  if (level <= 1) return "🥳";
  if (level === 2) return "🙂";
  if (level === 3) return "😌";
  if (level === 4) return "😮‍💨";
  return "🥵";
}

export function MemberActivityLoggerCard({ onLog, memberId }: MemberActivityLoggerCardProps) {
  const [showForm, setShowForm] = useState(false);
  const [activityName, setActivityName] = useState("Turgåing");
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [activityDateIso, setActivityDateIso] = useState(() => toIsoDateInputValue(new Date()));
  const [energyLevel, setEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [difficultyLevel, setDifficultyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [motivationLevel, setMotivationLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [comment, setComment] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoChange(file: File | null) {
    if (!file) return;
    setIsUploadingPhoto(true);
    setStatus(null);
    try {
      const compressed = await compressImageFile(file, 960, 0.78);
      if (compressed.length > MAX_ACTIVITY_PHOTO_CHARS) {
        setPhotoPreview("");
        setPhotoDataUrl("");
        setStatus("Bildet ble for stort. Prøv et nytt bilde eller lagre uten bilde.");
        return;
      }
      setPhotoPreview(compressed);
      setPhotoDataUrl(compressed);
    } catch {
      setStatus("Kunne ikke lese bildet. Prøv et annet bilde.");
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  function handleSave() {
    if (!memberId.trim()) return;
    if (!activityName.trim()) {
      setStatus("Skriv inn hva du har gjort (f.eks. turgåing).");
      return;
    }
    const duration = Number(durationMinutes.trim().replace(",", "."));
    if (!Number.isFinite(duration) || duration <= 0) {
      setStatus("Skriv inn varighet i minutter.");
      return;
    }
    if (!activityDateIso.trim()) {
      setStatus("Velg en gyldig dato.");
      return;
    }

    onLog({
      memberId,
      activityName: activityName.trim(),
      durationMinutes: String(Math.round(duration)),
      note: comment.trim(),
      reflection: {
        energyLevel,
        difficultyLevel,
        motivationLevel,
        note: comment.trim(),
      },
      photoUrl: photoDataUrl || undefined,
      date: activityDateIso,
      keepCurrentTab: true,
    });

    setStatus("Aktivitet lagret. PT kan se den under dine økter.");
    setEnergyLevel(3);
    setDifficultyLevel(3);
    setMotivationLevel(3);
    setComment("");
    setPhotoPreview("");
    setPhotoDataUrl("");
    setActivityDateIso(toIsoDateInputValue(new Date()));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      <article className="motus-training-hero motus-image-frame motus-image-frame--training-hero">
        <img
          className="motus-training-hero-cover motus-image-media"
          src={ACTIVITY_COVER_SRC}
          alt="Logg aktivitet"
          loading="lazy"
        />
        <div className="motus-training-hero-overlay" aria-hidden />
        <div className="motus-training-hero-content">
          <p className="motus-training-hero-label">Annen aktivitet</p>
          <h2 className="motus-training-hero-title">Logg aktivitet</h2>
          <p className="motus-training-hero-meta">
            Turgåing, sykling og annet — enkelt for PT å få oversikt over all bevegelse du gjør.
          </p>
          <div className="motus-training-hero-cta">
            <TrainingStartButton
              onClick={() => setShowForm((prev) => !prev)}
              className="w-full sm:w-auto"
              aria-expanded={showForm}
            >
              <Footprints className="h-4 w-4 text-white" aria-hidden />
              Logg aktivitet
            </TrainingStartButton>
          </div>
        </div>
      </article>

      {showForm ? (
        <div className="mt-4 rounded-xl border bg-slate-50 p-4 space-y-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">Dato</span>
              <TextInput
                type="date"
                value={activityDateIso}
                max={toIsoDateInputValue(new Date())}
                onChange={(event) => setActivityDateIso(event.target.value)}
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium text-slate-600">Aktivitet</span>
              <TextInput
                value={activityName}
                onChange={(event) => setActivityName(event.target.value)}
                placeholder="F.eks. turgåing"
                list="motus-activity-suggestions"
              />
              <datalist id="motus-activity-suggestions">
                {ACTIVITY_NAME_SUGGESTIONS.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">Varighet (min)</span>
              <TextInput
                type="number"
                min={1}
                max={600}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
                placeholder="45"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium text-slate-600">Bilde (valgfritt)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-700 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                onChange={(event) => void handlePhotoChange(event.target.files?.[0] ?? null)}
              />
              {isUploadingPhoto ? <div className="text-xs text-slate-500">Behandler bilde…</div> : null}
              {photoPreview ? (
                <img src={photoPreview} alt="Forhåndsvisning" className="mt-2 max-h-36 w-full rounded-xl object-cover" />
              ) : null}
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Kommentar til PT (valgfritt)</span>
            <TextArea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="min-h-[72px] !text-sm"
              placeholder="Hvordan gikk det? Vær, terreng, følelse…"
            />
          </label>

          {[
            { key: "activity-energy", question: "Hvordan føles energinivået nå?", value: energyLevel, setValue: setEnergyLevel },
            { key: "activity-difficulty", question: "Hvor tung opplevdes aktiviteten?", value: difficultyLevel, setValue: setDifficultyLevel },
            { key: "activity-motivation", question: "Hvordan er motivasjonen videre?", value: motivationLevel, setValue: setMotivationLevel },
          ].map((item) => (
            <div key={item.key} className="space-y-2">
              <div className="text-xs font-medium text-slate-700">{item.question}</div>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((level) => {
                  const numericLevel = level as 1 | 2 | 3 | 4 | 5;
                  const active = item.value === numericLevel;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => item.setValue(numericLevel)}
                      className={`rounded-xl border px-2 py-2 text-lg transition ${
                        active ? "border-teal-400 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                      aria-label={`Velg nivå ${level}`}
                    >
                      {getReflectionEmoji(numericLevel)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <GradientButton type="button" onClick={handleSave} className="w-full sm:w-auto">
              Lagre aktivitet
            </GradientButton>
            {status ? <div className="text-xs text-emerald-700">{status}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

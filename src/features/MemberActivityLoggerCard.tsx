import { Footprints } from "lucide-react";
import { useRef, useState } from "react";
import type { ReflectionLevel } from "../app/activityWorkoutLog";
import { compressImageFile } from "../app/imageCompress";
import type { LogActivityWorkoutInput } from "../services/appRepository";
import { GradientButton, TextArea, TextInput, TrainingStartButton } from "../app/ui";
import { ActivityNameCombobox } from "./ActivityNameCombobox";
import { ReflectionLevelPicker } from "./ReflectionLevelPicker";

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

export function MemberActivityLoggerCard({ onLog, memberId }: MemberActivityLoggerCardProps) {
  const [showForm, setShowForm] = useState(false);
  const [activityName, setActivityName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [activityDateIso, setActivityDateIso] = useState(() => toIsoDateInputValue(new Date()));
  const [energyLevel, setEnergyLevel] = useState<ReflectionLevel>(3);
  const [difficultyLevel, setDifficultyLevel] = useState<ReflectionLevel>(3);
  const [motivationLevel, setMotivationLevel] = useState<ReflectionLevel>(3);
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
    setActivityName("");
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
              <ActivityNameCombobox value={activityName} onChange={setActivityName} placeholder="Velg eller skriv aktivitet" />
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

          <ReflectionLevelPicker
            question="Hvordan føles energinivået nå?"
            value={energyLevel}
            onChange={setEnergyLevel}
          />
          <ReflectionLevelPicker
            question="Hvor tung opplevdes aktiviteten?"
            value={difficultyLevel}
            onChange={setDifficultyLevel}
          />
          <ReflectionLevelPicker
            question="Hvordan er motivasjonen videre?"
            value={motivationLevel}
            onChange={setMotivationLevel}
          />

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

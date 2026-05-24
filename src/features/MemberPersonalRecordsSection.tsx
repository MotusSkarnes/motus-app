import { ChevronRight, Share2, Sparkles, Star, TrendingUp } from "lucide-react";
import { MOTUS } from "../app/data";
import { resolveExerciseImageSrc } from "../app/exerciseIllustrations";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
import { STRENGTH_TRAINING_COVER_IMAGE } from "../app/programImage";
import type { Exercise } from "../app/types";
import { EmptyState, OutlineButton, StatusMessage } from "../app/ui";

export type PersonalRecordEntry = {
  name: string;
  weight: number;
  reps: number;
  score: number;
};

type MemberPersonalRecordsSectionProps = {
  records: PersonalRecordEntry[];
  previewRecords: PersonalRecordEntry[];
  showAll: boolean;
  onToggleShowAll: () => void;
  favoriteNames: string[];
  onToggleFavorite: (name: string) => void;
  onOpenProgress: (name: string) => void;
  onShare: (record: PersonalRecordEntry) => void;
  exercises: Exercise[];
  profileSaveInfo?: string | null;
};

function resolveRecordImage(name: string, exercises: Exercise[]): string {
  const normalized = name.trim().toLowerCase();
  const match = exercises.find((exercise) => exercise.name.trim().toLowerCase() === normalized);
  if (match) return resolveExerciseImageSrc(match);
  return STRENGTH_TRAINING_COVER_IMAGE;
}

function RecordSparkline({ tone }: { tone: "mint" | "pink" }) {
  const stroke = tone === "mint" ? MOTUS.turquoise : MOTUS.pink;
  return (
    <svg viewBox="0 0 80 24" className="mt-2 h-6 w-full" aria-hidden>
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="4,18 18,14 32,16 46,10 60,12 76,6"
      />
    </svg>
  );
}

export function MemberPersonalRecordsSection({
  records,
  previewRecords,
  showAll,
  onToggleShowAll,
  favoriteNames,
  onToggleFavorite,
  onOpenProgress,
  onShare,
  exercises,
  profileSaveInfo,
}: MemberPersonalRecordsSectionProps) {
  const hiddenCount = Math.max(0, records.length - previewRecords.length);

  return (
    <section className="motus-progress-section-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold tracking-tight text-slate-900">Personlige rekorder</h3>
          <p className="mt-0.5 text-xs text-slate-500">Trykk for styrkeutvikling. Stjernemerk opptil tre favoritter.</p>
        </div>
        {records.length > 0 ? (
          <button
            type="button"
            onClick={() => onToggleShowAll()}
            className="motus-pressable shrink-0 text-xs font-semibold text-[#0d9488] hover:text-teal-800"
          >
            {showAll ? "Vis færre" : `Se alle (${records.length})`}
            <ChevronRight className="ml-0.5 inline h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      {profileSaveInfo ? (
        <StatusMessage
          message={profileSaveInfo}
          tone={profileSaveInfo.toLowerCase().includes("maks tre") || profileSaveInfo.toLowerCase().includes("feilet") ? "error" : "success"}
          className="mt-3 !rounded-xl !px-3 !py-2 !text-sm"
        />
      ) : null}

      {records.length === 0 ? (
        <EmptyState
          icon="🏅"
          title="Ingen PR-er registrert ennå"
          description="Når du logger styrkeøkter, vises personlige rekorder her."
          className="mt-4 bg-slate-50/80"
        />
      ) : (
        <div className="motus-progress-pr-scroll scrollbar-none mt-4">
          {previewRecords.map((record, index) => {
            const imageSrc = resolveRecordImage(record.name, exercises);
            const isFavorite = favoriteNames.includes(record.name);
            return (
              <article key={record.name} className="motus-progress-pr-card">
                <button type="button" onClick={() => onOpenProgress(record.name)} className="motus-pressable block w-full text-left">
                  <div className="motus-progress-pr-image motus-image-frame motus-image-frame--square">
                    <img
                      src={imageSrc}
                      alt=""
                      className="motus-image-media"
                      loading="lazy"
                      style={{ objectPosition: imageObjectPositionFromSrc(imageSrc) }}
                    />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{record.name}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-600">
                    {record.weight} kg × {record.reps}
                  </p>
                  <RecordSparkline tone={index % 2 === 0 ? "mint" : "pink"} />
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0d9488]">
                    Se utvikling
                    <TrendingUp className="h-3 w-3" aria-hidden />
                  </p>
                </button>
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onShare(record)}
                    className="motus-pressable inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-teal-200 hover:text-teal-700"
                    aria-label={`Del personlig rekord for ${record.name}`}
                  >
                    <Share2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(record.name)}
                    className={`motus-pressable inline-flex h-8 w-8 items-center justify-center rounded-lg border p-0 ${
                      isFavorite ? "border-transparent motus-brand-fill text-white" : "border-slate-200 bg-white text-slate-400"
                    }`}
                    aria-label={isFavorite ? "Fjern fra fremhevede PR-er" : "Fremhev denne PR-en"}
                  >
                    <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-white" : ""}`} aria-hidden />
                  </button>
                </div>
              </article>
            );
          })}
          {!showAll && hiddenCount > 0 ? (
            <button type="button" onClick={onToggleShowAll} className="motus-progress-pr-more motus-pressable">
              <Sparkles className="h-5 w-5 text-[#D91278]" aria-hidden />
              <span className="mt-2 text-sm font-semibold text-[#0d9488]">+{hiddenCount} flere rekorder</span>
            </button>
          ) : null}
        </div>
      )}

      {records.length > 3 && showAll ? (
        <OutlineButton type="button" onClick={onToggleShowAll} className="mt-4 w-full sm:w-auto">
          Vis bare fremhevede / topp 3
        </OutlineButton>
      ) : null}
    </section>
  );
}

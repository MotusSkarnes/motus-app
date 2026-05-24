import { ChevronRight, Share2, Sparkles, Star } from "lucide-react";
import { MOTUS } from "../app/data";
import { resolveExerciseImageSrc } from "../app/exerciseIllustrations";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
import { resolveProgressPersonalRecordImage } from "../app/progressImagery";
import { STRENGTH_TRAINING_COVER_IMAGE } from "../app/programImage";
import type { Exercise } from "../app/types";
import { EmptyState, OutlineButton, StatusMessage } from "../app/ui";

export type PersonalRecordEntry = {
  name: string;
  weight: number;
  reps: number;
  score: number;
  isNewRecord?: boolean;
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
  variant?: "default" | "v2";
};

function resolveRecordImage(name: string, exercises: Exercise[]): string {
  const progressPhoto = resolveProgressPersonalRecordImage(name);
  if (progressPhoto) return progressPhoto;

  const normalized = name.trim().toLowerCase();
  const match = exercises.find((exercise) => exercise.name.trim().toLowerCase() === normalized);
  if (match) return resolveExerciseImageSrc(match);
  return STRENGTH_TRAINING_COVER_IMAGE;
}

function RecordSparkline({ tone }: { tone: "mint" | "pink" }) {
  const stroke = tone === "mint" ? MOTUS.turquoise : MOTUS.pink;
  return (
    <svg viewBox="0 0 80 24" className="mt-1.5 h-4 w-full" aria-hidden>
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
  variant = "default",
}: MemberPersonalRecordsSectionProps) {
  const hiddenCount = Math.max(0, records.length - previewRecords.length);
  const isV2 = variant === "v2";

  return (
    <section className={isV2 ? "motus-progress-v2-section" : "motus-progress-section-card"}>
      <div className={isV2 ? "motus-progress-v2-section-head" : "flex items-start justify-between gap-3"}>
        <div>
          <h3 className={isV2 ? "motus-progress-v2-section-title" : "text-base font-bold tracking-tight text-slate-900"}>
            Personlige rekorder
          </h3>
          {!isV2 ? (
            <p className="mt-0.5 text-xs text-slate-500">
              {showAll ? "Trykk stjernen for å velge opptil 3 fremhevede" : "Trykk for utvikling · stjernen velger fremhevede"}
            </p>
          ) : null}
        </div>
        {records.length > 0 ? (
          <button
            type="button"
            onClick={() => onToggleShowAll()}
            className={
              isV2
                ? "motus-progress-v2-section-link motus-pressable"
                : "motus-pressable shrink-0 text-xs font-semibold text-[#0d9488] hover:text-teal-800"
            }
          >
            {showAll ? "Vis færre" : `Se alle (${records.length})`}
            <ChevronRight className={isV2 ? "h-3.5 w-3.5" : "ml-0.5 inline h-3.5 w-3.5"} aria-hidden />
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
        <>
          <div
            className={`motus-progress-pr-grid scrollbar-none mt-3 ${showAll ? "motus-progress-pr-grid--all" : ""} ${isV2 ? "motus-progress-pr-grid--v2" : ""}`}
            role="list"
            aria-label="Personlige rekorder"
          >
            {previewRecords.map((record, index) => {
              const imageSrc = resolveRecordImage(record.name, exercises);
              const isFavorite = favoriteNames.includes(record.name);
              return (
                <article
                  key={record.name}
                  role="listitem"
                  className={`motus-progress-pr-card ${isV2 ? "motus-progress-pr-card--v2" : "motus-progress-pr-card--animated"}`}
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <button type="button" onClick={() => onOpenProgress(record.name)} className="motus-pressable block w-full text-left">
                    <div className="relative">
                      <div className={`motus-progress-pr-image ${isV2 ? "motus-progress-pr-image--v2" : "motus-image-frame motus-image-frame--square"}`}>
                        <img
                          src={imageSrc}
                          alt=""
                          className={isV2 ? "motus-progress-pr-image-media" : "motus-image-media"}
                          loading="lazy"
                          style={isV2 ? undefined : { objectPosition: imageObjectPositionFromSrc(imageSrc) }}
                        />
                      </div>
                      {record.isNewRecord ? (
                        <span className={isV2 ? "motus-progress-pr-new-badge motus-progress-pr-new-badge--v2" : "motus-progress-pr-new-badge"}>
                          Ny rekord
                        </span>
                      ) : null}
                    </div>
                    <p className={`motus-progress-pr-v2-name line-clamp-2 font-bold leading-snug text-slate-900 ${isV2 ? "text-sm" : "mt-1.5 text-[11px]"}`}>
                      {record.name}
                    </p>
                    <div className={isV2 ? "motus-progress-pr-v2-meta" : undefined}>
                      <p className={`font-semibold tabular-nums ${isV2 ? "text-sm text-[#0d9488]" : "mt-0.5 text-[10px] text-slate-700"}`}>
                        {record.weight} kg{isV2 ? ` · ${record.reps} reps` : ` × ${record.reps}`}
                      </p>
                      {!isV2 ? <RecordSparkline tone={index % 2 === 0 ? "mint" : "pink"} /> : null}
                    </div>
                  </button>
                  {!isV2 ? (
                  <div className="mt-1.5 flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => onShare(record)}
                      className="motus-pressable inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-teal-200 hover:text-teal-700"
                      aria-label={`Del personlig rekord for ${record.name}`}
                    >
                      <Share2 className="h-3 w-3" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(record.name)}
                      className="motus-favorite-star-toggle motus-favorite-star-toggle--compact motus-pressable"
                      aria-label={isFavorite ? "Fjern fra fremhevede PR-er" : "Fremhev denne PR-en"}
                      aria-pressed={isFavorite}
                    >
                      <Star className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          {!showAll && hiddenCount > 0 ? (
            <button type="button" onClick={onToggleShowAll} className="motus-progress-pr-more-pill motus-pressable mt-3">
              <Sparkles className="h-4 w-4 text-[#D91278]" aria-hidden />
              +{hiddenCount} flere rekorder
            </button>
          ) : null}

          {records.length > 3 && showAll ? (
            <OutlineButton type="button" onClick={onToggleShowAll} className="mt-3 w-full sm:w-auto">
              Vis bare fremhevede / topp 3
            </OutlineButton>
          ) : null}
        </>
      )}
    </section>
  );
}

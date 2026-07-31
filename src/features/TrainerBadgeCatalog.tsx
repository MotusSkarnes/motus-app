import { useEffect, useMemo, useRef, useState } from "react";
import { Award, EyeOff, Sparkles } from "lucide-react";
import { memberBadgeImageSrc, WORKOUT_CLUB_BADGE_IMAGE_BY_TARGET } from "../app/badgeAssets";
import {
  BADGE_CUSTOMIZATIONS_CHANGED_EVENT,
  badgeCustomizationFrame,
  badgeCustomImageStyle,
  clearBadgeCustomization,
  customizeBadgeText,
  readBadgeCustomizations,
  resolveCustomBadgeImage,
  updateBadgeCustomization,
  type BadgeCustomization,
  type BadgeCustomizations,
} from "../app/badgeCustomization";
import { MOTUS } from "../app/data";
import { compressImageFile } from "../app/imageCompress";
import type { ProgramCoverFrame } from "../app/imageFocalPoint";
import { getMemberBadgeCatalog } from "../app/memberBadges";
import { Card, MotusSectionIcon, TextArea, TextInput } from "../app/ui";
import { BadgeImage } from "./BadgeImage";

const MOTUS_GRADIENT = `${MOTUS.gradient}`;

const CLUB_MILESTONES = [100, 200, 300, 400, 500] as const;

type EditableBadge = {
  id: string;
  title: string;
  description: string;
};

function BadgeEditPanel({
  badge,
  fallbackImageSrc,
  customization,
  onCustomizationsChange,
}: {
  badge: EditableBadge;
  fallbackImageSrc: string;
  customization?: BadgeCustomization;
  onCustomizationsChange: (next: BadgeCustomizations) => void;
}) {
  const displayBadge = customizeBadgeText(badge, { [badge.id]: customization ?? {} });
  const imageSrc = resolveCustomBadgeImage(badge.id, fallbackImageSrc, { [badge.id]: customization ?? {} });
  const hasCustom = Boolean(customization);
  const hasCustomImage = Boolean(customization?.imageUrl);
  const frame = badgeCustomizationFrame(customization);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function patch(patchValue: BadgeCustomization | ((current: BadgeCustomization) => BadgeCustomization)) {
    onCustomizationsChange(updateBadgeCustomization(badge.id, patchValue));
  }

  function updateFrame(patchValue: Partial<ProgramCoverFrame>) {
    patch((current) => ({
      ...current,
      frame: {
        ...frame,
        ...patchValue,
      },
    }));
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    setUploadStatus("Behandler bilde...");
    try {
      const compressed = await compressImageFile(file, 900, 0.86);
      patch((current) => ({
        ...current,
        imageUrl: compressed,
        frame: current.frame ?? frame,
      }));
      setUploadStatus("Bilde lagret på badgen.");
    } catch {
      setUploadStatus("Kunne ikke lese bildet.");
    }
  }

  return (
    <div className="mt-3 rounded-xl border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex justify-center overflow-hidden rounded-xl bg-white p-2">
          <BadgeImage
            src={imageSrc}
            alt={displayBadge.title}
            size="tile"
            imageClassName={hasCustomImage ? "object-cover" : "object-contain"}
            imageStyle={hasCustomImage ? badgeCustomImageStyle(customization?.frame) : undefined}
          />
        </div>
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-slate-700">Tittel</span>
            <TextInput
              value={customization?.title ?? ""}
              onChange={(event) => patch({ ...customization, title: event.target.value })}
              placeholder={badge.title}
              className="!h-9"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-slate-700">Beskrivelse</span>
            <TextArea
              value={customization?.description ?? ""}
              onChange={(event) => patch({ ...customization, description: event.target.value })}
              placeholder={badge.description}
              className="min-h-[72px]"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                const input = event.currentTarget;
                void handleUpload(input.files?.[0] ?? null).finally(() => {
                  input.value = "";
                });
              }}
            />
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
              onClick={() => fileInputRef.current?.click()}
            >
              {hasCustomImage ? "Bytt bilde" : "Last opp bilde"}
            </button>
            {hasCustomImage ? (
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                onClick={() => patch((current) => ({ ...current, imageUrl: undefined, frame: undefined }))}
              >
                Fjern bilde
              </button>
            ) : null}
            {hasCustom ? (
              <button
                type="button"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                onClick={() => onCustomizationsChange(clearBadgeCustomization(badge.id))}
              >
                Nullstill badge
              </button>
            ) : null}
          </div>
          {uploadStatus ? <p className="text-[11px] text-slate-500">{uploadStatus}</p> : null}
        </div>
      </div>
      {hasCustomImage ? (
        <div className="mt-3 space-y-2 rounded-lg border bg-white p-2.5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          <div className="text-[11px] font-semibold text-slate-700">Juster utsnitt</div>
          <label className="block space-y-1">
            <span className="flex justify-between text-[10px] text-slate-500">
              <span>Zoom ut - inn</span>
              <span>{Math.round(frame.zoom * 100)} %</span>
            </span>
            <input type="range" min={100} max={225} value={Math.round(frame.zoom * 100)} className="w-full accent-slate-800" onChange={(event) => updateFrame({ zoom: Number(event.target.value) / 100 })} />
          </label>
          <label className="block space-y-1">
            <span className="flex justify-between text-[10px] text-slate-500">
              <span>Venstre - høyre</span>
              <span>{Math.round(frame.focalX * 100)} %</span>
            </span>
            <input type="range" min={0} max={100} value={Math.round(frame.focalX * 100)} className="w-full accent-slate-800" onChange={(event) => updateFrame({ focalX: Number(event.target.value) / 100 })} />
          </label>
          <label className="block space-y-1">
            <span className="flex justify-between text-[10px] text-slate-500">
              <span>Opp - ned</span>
              <span>{Math.round(frame.focalY * 100)} %</span>
            </span>
            <input type="range" min={0} max={100} value={Math.round(frame.focalY * 100)} className="w-full accent-slate-800" onChange={(event) => updateFrame({ focalY: Number(event.target.value) / 100 })} />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function TrainerBadgeCatalog() {
  const { tracks, secrets } = useMemo(() => getMemberBadgeCatalog(), []);
  const [customizations, setCustomizations] = useState<BadgeCustomizations>(() => readBadgeCustomizations());

  useEffect(() => {
    const sync = () => setCustomizations(readBadgeCustomizations());
    window.addEventListener(BADGE_CUSTOMIZATIONS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BADGE_CUSTOMIZATIONS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const tracksByCategory = useMemo(() => {
    const order = ["Trening", "Streaks", "Styrke", "Aktivitet", "Utfordringer"];
    const grouped = new Map<string, typeof tracks>();
    tracks.forEach((track) => {
      const list = grouped.get(track.categoryTitle) ?? [];
      list.push(track);
      grouped.set(track.categoryTitle, list);
    });
    return order
      .filter((title) => grouped.has(title))
      .map((title) => ({ title, tracks: grouped.get(title) ?? [] }));
  }, [tracks]);

  return (
    <div className="motus-badges-section space-y-4 overflow-visible sm:space-y-5">
      <Card className="p-4 sm:p-5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        <div className="flex items-start gap-3">
          <MotusSectionIcon className="!p-2.5">
            <Award className="h-5 w-5" />
          </MotusSectionIcon>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">Badge-oversikt</h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Alle badges medlemmene kan oppnå i appen. Dette er en referanse for deg som PT — ikke en oversikt over hva
              hver kunde har låst opp.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Medlemmer ser badges på <span className="font-medium">Oversikt</span>-fanen. Skjulte badges vises først når
              de er oppnådd.
            </p>
          </div>
        </div>
      </Card>

      {tracksByCategory.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{group.title}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {group.tracks.map((track) => {
              const displayTrack = customizeBadgeText(track, customizations);
              const trackImageSrc = resolveCustomBadgeImage(track.id, memberBadgeImageSrc(track.id), customizations);
              const trackCustom = customizations[track.id];
              return (
              <Card
                key={track.id}
                className="overflow-visible p-3 sm:p-4"
                style={{ borderColor: "rgba(15,23,42,0.08)" }}
              >
                <div className="flex items-start gap-4">
                  {track.id === "workout-club" ? (
                    <div className="flex w-[11.5rem] shrink-0 flex-col items-center gap-1.5 overflow-visible">
                      {CLUB_MILESTONES.map((target) => (
                        <div key={target} className="flex flex-col items-center gap-0.5">
                          <BadgeImage src={WORKOUT_CLUB_BADGE_IMAGE_BY_TARGET[target]} alt={`${target} klubben`} size="catalog" />
                          <span className="text-[9px] font-bold text-slate-500">{target}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex w-[11.5rem] shrink-0 justify-center overflow-visible">
                      <BadgeImage
                        src={trackImageSrc}
                        alt={displayTrack.title}
                        size="catalog"
                        imageClassName={trackCustom?.imageUrl ? "object-cover" : "object-contain"}
                        imageStyle={trackCustom?.imageUrl ? badgeCustomImageStyle(trackCustom.frame) : undefined}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <h3 className="break-words text-sm font-bold text-slate-900">{displayTrack.title}</h3>
                    {track.titleNote ? (
                      <p className="mt-0.5 break-words text-[11px] leading-snug text-slate-500">{track.titleNote}</p>
                    ) : null}
                    <p className="mt-1 break-words text-xs leading-relaxed text-slate-600">{displayTrack.description}</p>
                    <div className="mt-3 overflow-hidden rounded-xl border" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-2.5 py-1.5 font-semibold">Nivå</th>
                            <th className="px-2.5 py-1.5 font-semibold">Krav</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {track.levels.map((level) => (
                            <tr key={`${track.id}-${level.levelName}`}>
                              <td className="px-2.5 py-1.5 font-medium text-slate-800">{level.levelName}</td>
                              <td className="px-2.5 py-1.5 text-slate-600">{level.targetLabel}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <BadgeEditPanel
                      badge={track}
                      fallbackImageSrc={memberBadgeImageSrc(track.id)}
                      customization={customizations[track.id]}
                      onCustomizationsChange={setCustomizations}
                    />
                  </div>
                </div>
              </Card>
              );
            })}
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Skjulte badges ({secrets.length})</h2>
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          Vises ikke i listen hos medlemmet før de er oppnådd. Teksten under er hvordan kravet beskrives når badgen er
          låst opp.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {secrets.map((secret) => {
            const displaySecret = customizeBadgeText(secret, customizations);
            const secretCustom = customizations[secret.id];
            const secretImageSrc = resolveCustomBadgeImage(secret.id, memberBadgeImageSrc(secret.id), customizations);
            return (
            <Card
              key={secret.id}
              className="overflow-visible p-3"
              style={{ borderColor: "rgba(15,23,42,0.08)", backgroundColor: "#fafafa" }}
            >
              <div className="flex items-start gap-3">
                <div className="flex w-[11.5rem] shrink-0 justify-center overflow-visible">
                  <BadgeImage
                    src={secretImageSrc}
                    alt={displaySecret.title}
                    size="catalog"
                    imageClassName={secretCustom?.imageUrl ? "object-cover" : "object-contain"}
                    imageStyle={secretCustom?.imageUrl ? badgeCustomImageStyle(secretCustom.frame) : undefined}
                  />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="break-words text-xs font-bold text-slate-900">{displaySecret.title}</h3>
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase text-white"
                      style={{ background: MOTUS_GRADIENT }}
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      Skjult
                    </span>
                  </div>
                  <p className="mt-1 break-words text-[11px] leading-snug text-slate-600">{displaySecret.description}</p>
                  <p className="mt-1.5 text-[10px] font-semibold text-teal-800">Krav: {secret.unlockLabel}</p>
                  <BadgeEditPanel
                    badge={secret}
                    fallbackImageSrc={memberBadgeImageSrc(secret.id)}
                    customization={customizations[secret.id]}
                    onCustomizationsChange={setCustomizations}
                  />
                </div>
              </div>
            </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

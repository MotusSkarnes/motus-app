import { useMemo } from "react";
import { Award, EyeOff, Sparkles } from "lucide-react";
import { memberBadgeImageSrc, WORKOUT_CLUB_BADGE_IMAGE_BY_TARGET } from "../app/badgeAssets";
import { MOTUS } from "../app/data";
import { getMemberBadgeCatalog } from "../app/memberBadges";
import { Card, MotusSectionIcon } from "../app/ui";
import { BadgeImage } from "./BadgeImage";

const MOTUS_GRADIENT = `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`;

const CLUB_MILESTONES = [100, 200, 300, 400, 500] as const;

export function TrainerBadgeCatalog() {
  const { tracks, secrets } = useMemo(() => getMemberBadgeCatalog(), []);

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
            {group.tracks.map((track) => (
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
                      <BadgeImage src={memberBadgeImageSrc(track.id)} alt={track.title} size="catalog" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <h3 className="break-words text-sm font-bold text-slate-900">{track.title}</h3>
                    {track.titleNote ? (
                      <p className="mt-0.5 break-words text-[11px] leading-snug text-slate-500">{track.titleNote}</p>
                    ) : null}
                    <p className="mt-1 break-words text-xs leading-relaxed text-slate-600">{track.description}</p>
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
                  </div>
                </div>
              </Card>
            ))}
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
          {secrets.map((secret) => (
            <Card
              key={secret.id}
              className="overflow-visible p-3"
              style={{ borderColor: "rgba(15,23,42,0.08)", backgroundColor: "#fafafa" }}
            >
              <div className="flex items-start gap-3">
                <div className="flex w-[11.5rem] shrink-0 justify-center overflow-visible">
                  <BadgeImage src={memberBadgeImageSrc(secret.id)} alt={secret.title} size="catalog" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="break-words text-xs font-bold text-slate-900">{secret.title}</h3>
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase text-white"
                      style={{ background: MOTUS_GRADIENT }}
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      Skjult
                    </span>
                  </div>
                  <p className="mt-1 break-words text-[11px] leading-snug text-slate-600">{secret.description}</p>
                  <p className="mt-1.5 text-[10px] font-semibold text-teal-800">Krav: {secret.unlockLabel}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { MOTUS } from "../app/data";
import { formatDateDdMmYyyy } from "../app/dateFormat";
import { toCalendarDateKey } from "../app/memberTrainingCalendar";
import {
  buildTrainerCalendarMonthCells,
  buildTrainerPeriodPlanCalendarByMonth,
  summarizeTrainerCalendarDay,
  type TrainerCalendarPlanEntry,
} from "../app/trainerPeriodPlanCalendar";
import type { Member, PeriodSchedulePlan, WorkoutLog } from "../app/types";
import { OutlineButton } from "../app/ui";

type TrainerPeriodPlanCalendarProps = {
  members: Member[];
  periodPlansByMemberId: Record<string, PeriodSchedulePlan[]>;
  logs: WorkoutLog[];
  onOpenClient: (memberId: string) => void;
};

function statusLabel(status: TrainerCalendarPlanEntry["status"], isPassive: boolean): string {
  if (isPassive) return "Hviledag";
  if (status === "completed") return "Fullført";
  if (status === "missed") return "Ikke logget";
  if (status === "planned") return "Planlagt";
  return "—";
}

function statusClass(status: TrainerCalendarPlanEntry["status"], isPassive: boolean): string {
  if (isPassive) return "bg-slate-100 text-slate-600";
  if (status === "completed") return "bg-emerald-50 text-emerald-800";
  if (status === "missed") return "bg-rose-50 text-rose-800";
  if (status === "planned") return "bg-teal-50 text-teal-900";
  return "bg-slate-50 text-slate-600";
}

export function TrainerPeriodPlanCalendar({
  members,
  periodPlansByMemberId,
  logs,
  onOpenClient,
}: TrainerPeriodPlanCalendarProps) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const calendarMonthLabel = calendarMonth.toLocaleDateString("no-NO", {
    month: "long",
    year: "numeric",
  });

  const { byDay, byDateKey } = useMemo(
    () =>
      buildTrainerPeriodPlanCalendarByMonth({
        members,
        periodPlansByMemberId,
        logs,
        calendarMonth,
      }),
    [members, periodPlansByMemberId, logs, calendarMonth],
  );

  const calendarCells = useMemo(() => buildTrainerCalendarMonthCells(calendarMonth), [calendarMonth]);

  const selectedEntries = selectedDateKey ? (byDateKey.get(selectedDateKey) ?? []) : [];
  const selectedDate = selectedDateKey
    ? (() => {
        const [year, month, day] = selectedDateKey.split("-").map(Number);
        return new Date(year, month - 1, day);
      })()
    : null;

  const clientsWithPlans = useMemo(() => {
    const ids = new Set<string>();
    Object.entries(periodPlansByMemberId).forEach(([memberId, plans]) => {
      if (plans.length > 0) ids.add(memberId);
    });
    return members.filter((member) => member.isActive !== false && ids.has(member.id)).length;
  }, [members, periodPlansByMemberId]);

  return (
    <div className="motus-trainer-calendar space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Periodeplan-kalender</h1>
          <p className="mt-1 text-sm text-slate-600">
            Oversikt over planlagte økter for {clientsWithPlans} klient{clientsWithPlans === 1 ? "" : "er"} denne måneden.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OutlineButton
            type="button"
            className="!min-h-8 !px-3 !py-1.5 !text-xs"
            onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          >
            Forrige
          </OutlineButton>
          <OutlineButton
            type="button"
            className="!min-h-8 !px-3 !py-1.5 !text-xs"
            onClick={() => {
              const today = new Date();
              setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              setSelectedDateKey(toCalendarDateKey(today));
            }}
          >
            I dag
          </OutlineButton>
          <OutlineButton
            type="button"
            className="!min-h-8 !px-3 !py-1.5 !text-xs"
            onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          >
            Neste
          </OutlineButton>
        </div>
      </header>

      <section className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        <p className="text-xs font-medium capitalize text-slate-500">{calendarMonthLabel}</p>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-500">
          <span>Ma</span>
          <span>Ti</span>
          <span>On</span>
          <span>To</span>
          <span>Fr</span>
          <span>Lø</span>
          <span>Sø</span>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {calendarCells.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} aria-hidden />;
            const entries = byDay.get(day) ?? [];
            const summary = summarizeTrainerCalendarDay(entries);
            const dateKey = toCalendarDateKey(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
            const selected = selectedDateKey === dateKey;
            return (
              <button
                key={`${day}-${index}`}
                type="button"
                onClick={() => setSelectedDateKey((prev) => (prev === dateKey ? null : dateKey))}
                className={`min-h-[3.25rem] rounded-lg px-1 py-1.5 text-center text-xs transition ${
                  selected ? "ring-2 ring-slate-900/10" : ""
                } ${
                  summary.dayStatus === "completed"
                    ? "motus-brand-fill font-semibold"
                    : summary.dayStatus === "missed"
                      ? "bg-rose-50/80 text-rose-700"
                      : summary.dayStatus === "planned"
                        ? "motus-brand-muted font-medium"
                        : "bg-slate-50/90 text-slate-600"
                }`}
              >
                <div>{day}</div>
                {summary.activeCount > 0 ? (
                  <div className="mt-0.5 text-[10px] font-semibold opacity-80">{summary.activeCount} økt</div>
                ) : entries.some((entry) => entry.isPassive) ? (
                  <div className="mt-0.5 text-[10px] font-medium opacity-70">Hvile</div>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <div className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MOTUS.turquoise }} />
            <span>Fullført</span>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border border-dashed motus-brand-muted-border"
              style={{ backgroundColor: MOTUS.paleMint }}
            />
            <span>Planlagt</span>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border"
              style={{ borderColor: "rgba(244,63,94,0.55)", backgroundColor: "rgba(254,226,226,0.9)" }}
            />
            <span>Misset</span>
          </div>
        </div>
      </section>

      {selectedDate && selectedDateKey ? (
        <section className="rounded-2xl border bg-slate-50/80 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Planer {formatDateDdMmYyyy(selectedDate)}</h2>
            <span className="text-xs text-slate-500">
              {selectedEntries.filter((entry) => !entry.isPassive).length} aktive planer
            </span>
          </div>
          {selectedEntries.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Ingen periodeplaner denne dagen.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {selectedEntries.map((entry) => (
                <li key={`${entry.memberId}-${entry.planId}-${entry.entry}`}>
                  <button
                    type="button"
                    onClick={() => onOpenClient(entry.memberId)}
                    className="flex w-full items-start justify-between gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition hover:border-teal-200 hover:bg-teal-50/40"
                    style={{ borderColor: "rgba(15,23,42,0.08)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900">{entry.memberName}</div>
                      <div className="mt-0.5 text-xs text-slate-600">{entry.entryLabel}</div>
                      <div className="mt-1 text-[11px] text-slate-400">{entry.planTitle}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(entry.status, entry.isPassive)}`}>
                        {statusLabel(entry.status, entry.isPassive)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="text-sm text-slate-500">Velg en dag i kalenderen for å se planer per klient.</p>
      )}
    </div>
  );
}

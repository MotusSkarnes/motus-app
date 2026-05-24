import { ChevronRight, ClipboardPenLine, Clock3, MessageSquare, UserPlus } from "lucide-react";
import { MOTUS } from "../app/data";
import { formatNotificationTimestamp } from "../app/dateFormat";
import type { TrainerAlert } from "../app/useNotifications";

type TrainerNotificationsPanelProps = {
  alerts: TrainerAlert[];
  onOpenAlert: (alert: TrainerAlert) => void;
};

export function TrainerNotificationsPanel({ alerts, onOpenAlert }: TrainerNotificationsPanelProps) {
  if (!alerts.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200/80 bg-white/80 px-3 py-2.5 text-sm text-slate-500">
        Ingen nye ting å følge opp akkurat nå.
      </div>
    );
  }

  return (
    <div className="max-h-[min(22rem,70vh)] space-y-2 overflow-y-auto pr-1">
      {alerts.map((alert) => {
        const AlertIcon =
          alert.kind === "message"
            ? MessageSquare
            : alert.kind === "member-form"
              ? ClipboardPenLine
              : alert.kind === "missing-invite"
                ? UserPlus
                : Clock3;
        const isUnread = alert.isUnread;
        const isOpened = alert.isOpened && !isUnread;
        const isRead = !isUnread;
        const receivedAt = formatNotificationTimestamp(alert.timestamp);

        return (
          <button
            key={alert.id}
            type="button"
            onClick={() => onOpenAlert(alert)}
            className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left shadow-sm transition ${
              isOpened
                ? "border-slate-200/80 bg-slate-50/90 opacity-75 hover:bg-slate-100"
                : isUnread
                  ? "border-pink-200/90 bg-pink-50/40 hover:bg-pink-50/70"
                  : isRead
                    ? "border-slate-200/90 bg-slate-50/70 opacity-90 hover:bg-slate-100"
                    : "border-emerald-200/80 bg-white hover:bg-emerald-50"
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                alert.kind === "missing-invite"
                  ? isOpened || isRead
                    ? "bg-slate-100 text-slate-400"
                    : "bg-pink-50 text-pink-600"
                  : alert.kind === "inactive-member"
                    ? isOpened || isRead
                      ? "bg-slate-100 text-slate-400"
                      : "bg-amber-50 text-amber-600"
                    : isUnread
                      ? "bg-pink-100 text-pink-700"
                      : isOpened || isRead
                        ? "bg-slate-100 text-slate-400"
                        : "bg-emerald-50 text-emerald-600"
              }`}
            >
              <AlertIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-2">
                <span
                  className={`block text-sm ${
                    isOpened
                      ? "font-medium text-slate-500"
                      : isUnread
                        ? "font-semibold text-slate-900"
                        : isRead
                          ? "font-medium text-slate-600"
                          : "font-semibold text-slate-800"
                  }`}
                >
                  {alert.text}
                </span>
                {isUnread ? (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: MOTUS.pink }}
                  >
                    Ny
                  </span>
                ) : null}
              </span>
              <span className={`block truncate text-xs ${isOpened ? "text-slate-400" : "text-slate-500"}`}>{alert.detail}</span>
              {receivedAt ? (
                <span className={`mt-0.5 block text-[11px] ${isUnread ? "font-medium text-pink-700/80" : "text-slate-400"}`}>
                  {receivedAt}
                </span>
              ) : null}
            </span>
            <ChevronRight
              className={`h-4 w-4 shrink-0 transition ${isOpened ? "text-slate-300" : "text-slate-300 group-hover:text-teal-500"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

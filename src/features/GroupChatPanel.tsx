import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Send, UsersRound } from "lucide-react";
import { formatChatDateLabel, formatChatTime, chatDateKey } from "../app/chatFormat";
import { groupChatParticipantSummary } from "../app/trainingGroups";
import type { GroupChatMessage, TrainingGroup } from "../app/trainingGroups";

type GroupChatPanelProps = {
  group: TrainingGroup;
  messages: GroupChatMessage[];
  viewerRole: "trainer" | "member";
  viewerMemberId?: string;
  trainerName: string;
  members: Array<{ id: string; name: string }>;
  onSend: (text: string) => void;
  onBack?: () => void;
};

export function GroupChatPanel({
  group,
  messages,
  viewerRole,
  viewerMemberId,
  trainerName,
  members,
  onSend,
  onBack,
}: GroupChatPanelProps) {
  const [composeValue, setComposeValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const summary = groupChatParticipantSummary(group, members, trainerName);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  async function handleSend() {
    const text = composeValue.trim();
    if (!text || isSending) return;
    setIsSending(true);
    try {
      onSend(text);
      setComposeValue("");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="motus-chat-page">
      <header className="motus-chat-header">
        <div className="motus-chat-header-gradient" aria-hidden />
        <div className="motus-chat-header-inner">
          {onBack ? (
            <button type="button" className="motus-chat-header-icon motus-pressable" onClick={onBack} aria-label="Tilbake">
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="w-9" aria-hidden />
          )}
          <div className="min-w-0 flex-1 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-white">
              <UsersRound className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mt-2 truncate text-base font-bold text-slate-950">{group.name}</h2>
            <p className="truncate text-xs text-slate-500">{summary}</p>
          </div>
          <div className="w-9" aria-hidden />
        </div>
      </header>

      <div ref={scrollRef} className="motus-chat-thread">
        {messages.length === 0 ? (
          <div className="motus-chat-empty">
            <div className="text-3xl" aria-hidden>
              💬
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-800">Ingen gruppemeldinger ennå</p>
            <p className="mt-1 text-xs text-slate-500">PT er alltid med i samtalen. Skriv en oppdatering til gruppen.</p>
          </div>
        ) : null}

        {messages.map((message, index) => {
          const isOwn =
            viewerRole === "trainer"
              ? message.senderRole === "trainer"
              : message.senderRole === "member" && message.senderMemberId === viewerMemberId;
          const prev = index > 0 ? messages[index - 1] : null;
          const showDate = index === 0 || chatDateKey(message.createdAt) !== chatDateKey(prev?.createdAt ?? "");
          const showName = !isOwn && (index === 0 || messages[index - 1]?.senderName !== message.senderName);
          return (
            <div key={message.id}>
              {showDate ? <div className="motus-chat-date-separator">{formatChatDateLabel(message.createdAt)}</div> : null}
              <div className={`motus-chat-message-wrap ${isOwn ? "motus-chat-message-wrap--own" : "motus-chat-message-wrap--other"}`}>
                <div className="relative min-w-0 max-w-[75%]">
                  {showName ? (
                    <div className="mb-1 px-1 text-[11px] font-semibold text-slate-500">{message.senderName}</div>
                  ) : null}
                  <div className={`motus-chat-bubble ${isOwn ? "motus-chat-bubble--own" : "motus-chat-bubble--other"}`}>
                    <p className="whitespace-pre-wrap break-words">{message.text}</p>
                    <div className="motus-chat-bubble-meta">
                      <span>{formatChatTime(message.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="motus-chat-footer">
        <div className="flex items-end gap-2 px-3 pb-3 pt-2">
          <textarea
            value={composeValue}
            onChange={(event) => setComposeValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Skriv til gruppen…"
            rows={1}
            className="min-h-10 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            className="motus-pressable inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white disabled:opacity-50"
            onClick={() => void handleSend()}
            disabled={!composeValue.trim() || isSending}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}

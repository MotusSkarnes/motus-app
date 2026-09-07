import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { ChatMessage, ChatReactionActor, ChatReactionEmoji, Member } from "../app/types";
import { Card } from "../app/ui";
import {
  buildTrainerMessageInboxRows,
  filterMessagesForRosterMember,
  formatInboxTimestamp,
  memberHasTrainerMessagingAccess,
} from "../app/trainerMessagesInbox";
import { MotusChat } from "./MotusChat";

type TrainerMessagesHubViewProps = {
  members: Member[];
  messages: ChatMessage[];
  selectedMemberId: string;
  onSelectMember: (memberId: string) => void;
  unreadMessagesByMemberId: Record<string, number>;
  memberAvatarById: Record<string, string>;
  sendTrainerMessage: (memberId: string, text: string) => void;
  toggleChatMessageReaction: (messageId: string, emoji: ChatReactionEmoji, actor: ChatReactionActor) => void;
  markChatConversationRead: (memberId: string, reader: "trainer" | "member") => void;
  markTrainerMessagesReadForMember: (memberId: string) => void;
};

export function TrainerMessagesHubView({
  members,
  messages,
  selectedMemberId,
  onSelectMember,
  unreadMessagesByMemberId,
  memberAvatarById,
  sendTrainerMessage,
  toggleChatMessageReaction,
  markChatConversationRead,
  markTrainerMessagesReadForMember,
}: TrainerMessagesHubViewProps) {
  const [search, setSearch] = useState("");
  const [composeValue, setComposeValue] = useState("");
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const inboxRows = useMemo(
    () => buildTrainerMessageInboxRows(members, messages, unreadMessagesByMemberId),
    [members, messages, unreadMessagesByMemberId],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return inboxRows;
    return inboxRows.filter((row) => {
      const name = row.member.name.trim().toLowerCase();
      const email = row.member.email.trim().toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [inboxRows, search]);

  const selectedMember =
    members.find((member) => member.id === selectedMemberId) ??
    filteredRows[0]?.member ??
    inboxRows[0]?.member ??
    null;

  const effectiveSelectedId = selectedMember?.id ?? "";

  useEffect(() => {
    if (effectiveSelectedId && selectedMemberId !== effectiveSelectedId) {
      onSelectMember(effectiveSelectedId);
    }
  }, [effectiveSelectedId, onSelectMember, selectedMemberId]);

  const selectedMessages = useMemo(
    () => (effectiveSelectedId ? filterMessagesForRosterMember(messages, members, effectiveSelectedId) : []),
    [messages, members, effectiveSelectedId],
  );

  const messagingLocked = selectedMember ? !memberHasTrainerMessagingAccess(selectedMember) : false;
  const avatarUrl = selectedMember
    ? memberAvatarById[selectedMember.id] || selectedMember.avatarUrl || ""
    : "";

  useEffect(() => {
    setComposeValue("");
    setSendStatus(null);
  }, [effectiveSelectedId]);

  useEffect(() => {
    if (!effectiveSelectedId || messagingLocked) return;
    markChatConversationRead(effectiveSelectedId, "trainer");
    markTrainerMessagesReadForMember(effectiveSelectedId);
  }, [effectiveSelectedId, markChatConversationRead, markTrainerMessagesReadForMember, messagingLocked]);

  function handleSelectMember(memberId: string) {
    onSelectMember(memberId);
    setMobileShowThread(true);
  }

  async function handleSend() {
    if (!effectiveSelectedId || !composeValue.trim() || messagingLocked) return;
    setIsSending(true);
    setSendStatus("Sender…");
    try {
      sendTrainerMessage(effectiveSelectedId, composeValue);
      setComposeValue("");
      setSendStatus(null);
    } finally {
      setIsSending(false);
    }
  }

  const memberList = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200/80 px-3 py-3">
        <div className="text-sm font-semibold text-slate-900">Kunder</div>
        <label className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Søk etter kunde…"
            className="w-full bg-transparent outline-none placeholder:text-slate-400"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredRows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">Ingen kunder matcher søket.</div>
        ) : (
          filteredRows.map((row) => {
            const active = row.member.id === effectiveSelectedId;
            const rowAvatar = memberAvatarById[row.member.id] || row.member.avatarUrl || "";
            const initial = (row.member.name.trim().charAt(0) || "?").toUpperCase();
            return (
              <button
                key={row.member.id}
                type="button"
                onClick={() => handleSelectMember(row.member.id)}
                className={`flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left transition ${
                  active ? "bg-teal-50/80" : "bg-white hover:bg-slate-50"
                }`}
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
                  <span className="absolute inset-0 flex items-center justify-center">{initial}</span>
                  {rowAvatar ? (
                    <img src={rowAvatar} alt="" className="relative z-10 h-full w-full object-cover" loading="lazy" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className={`truncate text-sm ${row.unreadCount > 0 ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}>
                      {row.member.name}
                    </div>
                    {row.unreadCount > 0 ? (
                      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-600 px-1.5 text-[11px] font-semibold text-white">
                        {row.unreadCount > 9 ? "9+" : row.unreadCount}
                      </span>
                    ) : row.latestAtMs ? (
                      <span className="ml-auto shrink-0 text-[11px] text-slate-400">{formatInboxTimestamp(row.latestAtMs)}</span>
                    ) : null}
                  </div>
                  <div className={`mt-0.5 truncate text-xs ${row.unreadCount > 0 ? "font-medium text-slate-700" : "text-slate-500"}`}>
                    {row.preview}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const chatPane = (showBack: boolean) =>
    selectedMember ? (
      <MotusChat
        variant="trainer"
        messages={selectedMessages}
        viewerRole="trainer"
        counterpartyName={selectedMember.name.trim() || "Kunde"}
        counterpartyAvatarUrl={avatarUrl || null}
        locked={messagingLocked}
        lockedMessage="Denne kunden har ikke tilgang til meldinger."
        composeValue={composeValue}
        onComposeChange={(value) => {
          setComposeValue(value);
          if (sendStatus) setSendStatus(null);
        }}
        onSend={() => void handleSend()}
        isSending={isSending}
        sendDisabled={!composeValue.trim() || messagingLocked}
        composePlaceholder="Skriv melding…"
        sendStatus={sendStatus}
        messagesContainerRef={messagesContainerRef}
        onToggleReaction={toggleChatMessageReaction}
        onMarkConversationRead={
          !messagingLocked
            ? () => {
                markChatConversationRead(selectedMember.id, "trainer");
                markTrainerMessagesReadForMember(selectedMember.id);
              }
            : undefined
        }
        onBack={showBack ? () => setMobileShowThread(false) : undefined}
      />
    ) : (
      <div className="flex h-full min-h-[24rem] items-center justify-center px-6 text-center text-sm text-slate-500">
        Velg en kunde i listen for å se meldinger.
      </div>
    );

  return (
    <Card className="overflow-hidden p-0 shadow-sm ring-1 ring-black/5">
      <div className="border-b border-slate-200/80 px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Meldinger</h2>
        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Se og svar på meldinger fra kundene dine.</p>
      </div>

      {/* Mobile: list or thread */}
      <div className="lg:hidden">
        {mobileShowThread && selectedMember ? (
          <div className="min-h-[70vh]">{chatPane(true)}</div>
        ) : (
          <div className="max-h-[70vh] min-h-[24rem]">{memberList}</div>
        )}
      </div>

      {/* Desktop: chat left, members right */}
      <div className="hidden lg:grid lg:min-h-[70vh] lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,22rem)]">
        <div className="min-h-0 border-r border-slate-200/80">{chatPane(false)}</div>
        <div className="min-h-0 bg-slate-50/40">{memberList}</div>
      </div>
    </Card>
  );
}

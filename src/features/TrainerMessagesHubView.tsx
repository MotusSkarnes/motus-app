import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Search } from "lucide-react";
import type { ChatMessage, ChatReactionActor, ChatReactionEmoji, Member } from "../app/types";
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

  const totalUnread = useMemo(
    () => inboxRows.reduce((sum, row) => sum + (row.unreadCount > 0 ? row.unreadCount : 0), 0),
    [inboxRows],
  );

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
    <div className="motus-messages-hub__list">
      <div className="motus-messages-hub__list-head">
        <div className="motus-messages-hub__list-title-row">
          <h3 className="motus-messages-hub__list-title">Samtaler</h3>
          <span className="motus-messages-hub__list-count">{filteredRows.length}</span>
        </div>
        <label className="motus-messages-hub__search">
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Søk etter kunde…"
            aria-label="Søk etter kunde"
          />
        </label>
      </div>
      <div className="motus-messages-hub__list-body">
        {filteredRows.length === 0 ? (
          <div className="motus-messages-hub__empty-list">Ingen kunder matcher søket.</div>
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
                className={`motus-messages-hub__row motus-pressable ${active ? "motus-messages-hub__row--active" : ""} ${
                  row.unreadCount > 0 ? "motus-messages-hub__row--unread" : ""
                }`}
              >
                <div className="motus-messages-hub__avatar" aria-hidden>
                  <span>{initial}</span>
                  {rowAvatar ? <img src={rowAvatar} alt="" loading="lazy" /> : null}
                  {row.unreadCount > 0 ? <i className="motus-messages-hub__avatar-dot" /> : null}
                </div>
                <div className="motus-messages-hub__row-main">
                  <div className="motus-messages-hub__row-top">
                    <span className="motus-messages-hub__row-name">{row.member.name}</span>
                    {row.unreadCount > 0 ? (
                      <span className="motus-messages-hub__unread-badge">
                        {row.unreadCount > 9 ? "9+" : row.unreadCount}
                      </span>
                    ) : row.latestAtMs ? (
                      <span className="motus-messages-hub__row-time">{formatInboxTimestamp(row.latestAtMs)}</span>
                    ) : null}
                  </div>
                  <div className="motus-messages-hub__row-preview">{row.preview}</div>
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
      <div className="motus-messages-hub__empty-thread">
        <div className="motus-messages-hub__empty-thread-icon" aria-hidden>
          <MessageSquare className="h-6 w-6" />
        </div>
        <p className="motus-messages-hub__empty-thread-title">Velg en samtale</p>
        <p className="motus-messages-hub__empty-thread-text">Åpne en kunde i listen for å lese og svare.</p>
      </div>
    );

  return (
    <div className="motus-messages-hub motus-fade-in-up">
      <header className="motus-messages-hub__hero">
        <div className="motus-messages-hub__hero-copy">
          <div className="motus-messages-hub__hero-icon" aria-hidden>
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="motus-messages-hub__title">Meldinger</h2>
            <p className="motus-messages-hub__subtitle">Hold dialogen med kundene dine samlet på ett sted.</p>
          </div>
        </div>
        {totalUnread > 0 ? (
          <div className="motus-messages-hub__hero-chip" aria-label={`${totalUnread} uleste meldinger`}>
            <span className="motus-messages-hub__hero-chip-value">{totalUnread > 99 ? "99+" : totalUnread}</span>
            <span className="motus-messages-hub__hero-chip-label">ulest{totalUnread === 1 ? "" : "e"}</span>
          </div>
        ) : (
          <div className="motus-messages-hub__hero-chip motus-messages-hub__hero-chip--quiet">
            <span className="motus-messages-hub__hero-chip-label">Ingen uleste</span>
          </div>
        )}
      </header>

      <div className="motus-messages-hub__shell">
        <div className="lg:hidden">
          {mobileShowThread && selectedMember ? (
            <div className="motus-messages-hub__mobile-thread">{chatPane(true)}</div>
          ) : (
            <div className="motus-messages-hub__mobile-list">{memberList}</div>
          )}
        </div>

        <div className="motus-messages-hub__desktop">
          <aside className="motus-messages-hub__aside">{memberList}</aside>
          <section className="motus-messages-hub__thread">{chatPane(false)}</section>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Search, UsersRound } from "lucide-react";
import type { ChatMessage, ChatReactionActor, ChatReactionEmoji, Member } from "../app/types";
import {
  buildTrainerMessageInboxRows,
  filterMessagesForRosterMember,
  formatInboxTimestamp,
  memberHasTrainerMessagingAccess,
} from "../app/trainerMessagesInbox";
import { MotusChat } from "./MotusChat";
import { GroupChatPanel } from "./GroupChatPanel";
import type { GroupChatMessage, TrainingGroup } from "../app/trainingGroups";
import { parseChatCreatedAtMs } from "../app/chatFormat";

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
  trainingGroups?: TrainingGroup[];
  groupChatMessagesById?: Map<string, GroupChatMessage[]>;
  trainerName?: string;
  onSendGroupChatMessage?: (groupId: string, text: string) => void;
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
  trainingGroups = [],
  groupChatMessagesById = new Map(),
  trainerName = "PT",
  onSendGroupChatMessage,
}: TrainerMessagesHubViewProps) {
  const [search, setSearch] = useState("");
  const [composeValue, setComposeValue] = useState("");
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
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

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return trainingGroups;
    return trainingGroups.filter((group) => group.name.trim().toLowerCase().includes(query));
  }, [search, trainingGroups]);

  const selectedGroup = selectedGroupId
    ? trainingGroups.find((group) => group.id === selectedGroupId) ?? null
    : null;

  const selectedMember = selectedGroup
    ? null
    : members.find((member) => member.id === selectedMemberId) ??
      filteredRows[0]?.member ??
      inboxRows[0]?.member ??
      null;

  const effectiveSelectedId = selectedMember?.id ?? "";

  useEffect(() => {
    if (selectedGroup) return;
    if (effectiveSelectedId && selectedMemberId !== effectiveSelectedId) {
      onSelectMember(effectiveSelectedId);
    }
  }, [effectiveSelectedId, onSelectMember, selectedGroup, selectedMemberId]);

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
    if (selectedGroup || !effectiveSelectedId || messagingLocked) return;
    markChatConversationRead(effectiveSelectedId, "trainer");
    markTrainerMessagesReadForMember(effectiveSelectedId);
  }, [effectiveSelectedId, markChatConversationRead, markTrainerMessagesReadForMember, messagingLocked, selectedGroup]);

  function handleSelectMember(memberId: string) {
    setSelectedGroupId(null);
    onSelectMember(memberId);
    setMobileShowThread(true);
  }

  function handleSelectGroup(groupId: string) {
    setSelectedGroupId(groupId);
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
          <span className="motus-messages-hub__list-count">{filteredGroups.length + filteredRows.length}</span>
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
        {filteredGroups.length === 0 && filteredRows.length === 0 ? (
          <div className="motus-messages-hub__empty-list">Ingen samtaler matcher søket.</div>
        ) : (
          <>
            {filteredGroups.map((group) => {
              const thread = groupChatMessagesById.get(group.id) ?? [];
              const latest = thread[thread.length - 1];
              const latestAtMs = latest ? parseChatCreatedAtMs(latest.createdAt) : 0;
              const preview = latest?.text.trim().replace(/\s+/g, " ") || "Gruppechat · PT er alltid med";
              const active = group.id === selectedGroupId;
              return (
                <button
                  key={`group:${group.id}`}
                  type="button"
                  onClick={() => handleSelectGroup(group.id)}
                  className={`motus-messages-hub__row motus-pressable ${active ? "motus-messages-hub__row--active" : ""}`}
                >
                  <div className="motus-messages-hub__avatar" aria-hidden>
                    <UsersRound className="h-4 w-4" />
                  </div>
                  <div className="motus-messages-hub__row-main">
                    <div className="motus-messages-hub__row-top">
                      <span className="motus-messages-hub__row-name">{group.name}</span>
                      {latestAtMs ? (
                        <span className="motus-messages-hub__row-time">{formatInboxTimestamp(latestAtMs)}</span>
                      ) : null}
                    </div>
                    <div className="motus-messages-hub__row-preview">
                      {preview.length > 72 ? `${preview.slice(0, 71)}…` : preview}
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredRows.map((row) => {
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
          })}
          </>
        )}
      </div>
    </div>
  );

  const chatPane = (showBack: boolean) =>
    selectedGroup && onSendGroupChatMessage ? (
      <GroupChatPanel
        group={selectedGroup}
        messages={groupChatMessagesById.get(selectedGroup.id) ?? []}
        viewerRole="trainer"
        trainerName={trainerName}
        members={members}
        onSend={(text) => onSendGroupChatMessage(selectedGroup.id, text)}
        onBack={showBack ? () => setMobileShowThread(false) : undefined}
      />
    ) : selectedMember ? (
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
        composePlaceholder="Skriv melding..."
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
          {mobileShowThread && (selectedMember || selectedGroup) ? (
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

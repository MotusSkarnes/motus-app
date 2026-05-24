import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  ChevronLeft,
  Dumbbell,
  MoreHorizontal,
  Paperclip,
  Phone,
  Send,
  Share2,
  Smile,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { ChatMessage } from "../app/types";
import { chatDateKey, formatChatDateLabel, formatChatTime } from "../app/chatFormat";
import {
  CHAT_REACTION_EMOJIS,
  readMessageReactions,
  toggleMessageReaction,
  type ChatReactionEmoji,
} from "../app/chatReactions";

export type MotusChatQuickAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
};

export type MotusChatProps = {
  variant: "member" | "trainer";
  messages: ChatMessage[];
  viewerRole: "member" | "trainer";
  counterpartyName: string;
  counterpartyAvatarUrl?: string | null;
  counterpartyStatus?: string;
  counterpartyStatusHint?: string;
  composeValue: string;
  onComposeChange: (value: string) => void;
  onSend: () => void;
  isSending?: boolean;
  sendDisabled?: boolean;
  composePlaceholder?: string;
  sendStatus?: string | null;
  locked?: boolean;
  lockedMessage?: string;
  quickActions?: MotusChatQuickAction[];
  quickReplies?: string[];
  messagesContainerRef?: RefObject<HTMLDivElement | null>;
  onBack?: () => void;
  headerExtra?: ReactNode;
};

const DEFAULT_TRAINER_QUICK_REPLIES = [
  "💪 Bra jobbet!",
  "🔥 Sterk økt!",
  "👏 Fantastisk!",
  "🙌 Fortsett sånn!",
];

const DEFAULT_MEMBER_QUICK_REPLIES = ["Hei! Kort status:", "Trenger hjelp med programmet", "Kan vi justere planen?"];

const DEFAULT_QUICK_ACTIONS: MotusChatQuickAction[] = [
  { id: "workout", label: "Send økt", icon: Dumbbell },
  { id: "program", label: "Del program", icon: Share2 },
  { id: "more", label: "Flere", icon: MoreHorizontal },
];

function AvatarBubble({
  name,
  avatarUrl,
  size = "md",
  gradient = false,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  gradient?: boolean;
}) {
  const sizeClass = size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border border-white/90 shadow-sm ${sizeClass} ${gradient ? "motus-chat-avatar-gradient text-white" : "bg-slate-100 text-slate-500"}`}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-semibold">{initial}</span>
      )}
    </div>
  );
}

function useLongPress(onLongPress: () => void, delayMs = 450) {
  const timerRef = useRef<number | null>(null);
  const start = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(onLongPress, delayMs);
  }, [delayMs, onLongPress]);
  const cancel = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => cancel, [cancel]);
  return { start, cancel };
}

function ReactionBar({
  messageId,
  viewerRole,
  align,
  onReactionChange,
}: {
  messageId: string;
  viewerRole: "member" | "trainer";
  align: "left" | "right";
  onReactionChange: () => void;
}) {
  const reactions = readMessageReactions(messageId);
  const entries = CHAT_REACTION_EMOJIS.flatMap((emoji) => {
    const actors = reactions[emoji] ?? [];
    if (actors.length === 0) return [];
    return [{ emoji, count: actors.length, own: actors.includes(viewerRole) }];
  });
  if (entries.length === 0) return null;
  return (
    <div className={`motus-chat-reactions ${align === "right" ? "justify-end" : "justify-start"}`}>
      {entries.map(({ emoji, count, own }) => (
        <button
          key={emoji}
          type="button"
          className={`motus-chat-reaction-pill motus-pressable ${own ? "motus-chat-reaction-pill--own" : ""}`}
          onClick={() => {
            toggleMessageReaction(messageId, emoji, viewerRole);
            onReactionChange();
          }}
        >
          <span aria-hidden>{emoji}</span>
          <span>{count}</span>
        </button>
      ))}
    </div>
  );
}

function MessageBubble({
  message,
  isOwn,
  showAvatar,
  counterpartyName,
  counterpartyAvatarUrl,
  viewerRole,
  isNewest,
  onReactionChange,
}: {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar: boolean;
  counterpartyName: string;
  counterpartyAvatarUrl?: string | null;
  viewerRole: "member" | "trainer";
  isNewest: boolean;
  onReactionChange: () => void;
}) {
  const [reactionOpen, setReactionOpen] = useState(false);
  const [reactionPulse, setReactionPulse] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const openReactions = useCallback(() => {
    setReactionOpen(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(12);
    }
  }, []);

  const longPress = useLongPress(openReactions);

  const pickReaction = (emoji: ChatReactionEmoji) => {
    toggleMessageReaction(message.id, emoji, viewerRole);
    setReactionOpen(false);
    setReactionPulse(true);
    onReactionChange();
    window.setTimeout(() => setReactionPulse(false), 320);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(8);
    }
  };

  useEffect(() => {
    if (!reactionOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setReactionOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [reactionOpen]);

  return (
    <div
      ref={wrapRef}
      className={`motus-chat-message-wrap ${isOwn ? "motus-chat-message-wrap--own" : "motus-chat-message-wrap--other"}`}
    >
      {!isOwn && showAvatar ? (
        <AvatarBubble name={counterpartyName} avatarUrl={counterpartyAvatarUrl} size="sm" gradient />
      ) : !isOwn ? (
        <div className="h-8 w-8 shrink-0" aria-hidden />
      ) : null}

      <div className="relative min-w-0 max-w-[75%]">
        {reactionOpen ? (
          <div className={`motus-chat-reaction-popup ${isOwn ? "right-0" : "left-0"}`}>
            {CHAT_REACTION_EMOJIS.map((emoji) => (
              <button key={emoji} type="button" className="motus-chat-reaction-option motus-pressable" onClick={() => pickReaction(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        <div
          className={`motus-chat-bubble ${isOwn ? "motus-chat-bubble--own" : "motus-chat-bubble--other"} ${isNewest ? "motus-chat-bubble--enter" : ""} ${reactionPulse ? "motus-chat-bubble--pulse" : ""}`}
          onTouchStart={longPress.start}
          onTouchEnd={longPress.cancel}
          onTouchMove={longPress.cancel}
          onContextMenu={(event) => {
            event.preventDefault();
            openReactions();
          }}
        >
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
          <div className="motus-chat-bubble-meta">
            <span>{formatChatTime(message.createdAt)}</span>
            {isOwn ? (
              <span className="motus-chat-read-mark" aria-label="Sendt">
                ✓✓
              </span>
            ) : null}
          </div>
        </div>

        <ReactionBar messageId={message.id} viewerRole={viewerRole} align={isOwn ? "right" : "left"} onReactionChange={onReactionChange} />
      </div>
    </div>
  );
}

export function MotusChat({
  variant,
  messages,
  viewerRole,
  counterpartyName,
  counterpartyAvatarUrl,
  counterpartyStatus = "Online nå",
  counterpartyStatusHint = "Svar vanligvis innen 1 time",
  composeValue,
  onComposeChange,
  onSend,
  isSending = false,
  sendDisabled = false,
  composePlaceholder = "Skriv melding...",
  sendStatus,
  locked = false,
  lockedMessage = "Meldinger er ikke tilgjengelig.",
  quickActions,
  quickReplies,
  messagesContainerRef,
  onBack,
  headerExtra,
}: MotusChatProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const scrollRef = messagesContainerRef ?? internalRef;
  const [reactionVersion, setReactionVersion] = useState(0);
  const resolvedQuickActions = quickActions ?? DEFAULT_QUICK_ACTIONS;
  const resolvedQuickReplies = quickReplies ?? (variant === "trainer" ? DEFAULT_TRAINER_QUICK_REPLIES : DEFAULT_MEMBER_QUICK_REPLIES);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, scrollRef, reactionVersion]);

  const handleSend = () => {
    if (sendDisabled || isSending || !composeValue.trim()) return;
    onSend();
  };

  if (locked) {
    return (
      <div className="motus-chat-shell">
        <div className="motus-chat-locked">{lockedMessage}</div>
      </div>
    );
  }

  return (
    <div className="motus-chat-shell">
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
            <div className="mx-auto w-fit">
              <AvatarBubble name={counterpartyName} avatarUrl={counterpartyAvatarUrl} size="lg" gradient />
            </div>
            <h2 className="mt-2 truncate text-base font-bold text-slate-950">{counterpartyName}</h2>
            <p className="mt-0.5 flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600">
              <span className="motus-chat-online-dot" aria-hidden />
              {counterpartyStatus}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">{counterpartyStatusHint}</p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="motus-chat-header-icon motus-pressable" aria-label="Ring">
              <Phone className="h-4 w-4" />
            </button>
            <button type="button" className="motus-chat-header-icon motus-pressable" aria-label="Video">
              <Video className="h-4 w-4" />
            </button>
            <button type="button" className="motus-chat-header-icon motus-pressable" aria-label="Flere valg">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
        {headerExtra}
      </header>

      {resolvedQuickActions.length > 0 ? (
        <div className="motus-chat-quick-actions scrollbar-none">
          {resolvedQuickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.id} type="button" className="motus-chat-quick-action motus-pressable" onClick={action.onClick}>
                <span className="motus-chat-quick-action-icon">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div ref={scrollRef} className="motus-chat-thread">
        {messages.length === 0 ? (
          <div className="motus-chat-empty">
            <div className="text-3xl" aria-hidden>
              💬
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-800">Ingen meldinger ennå</p>
            <p className="mt-1 text-xs text-slate-500">Start samtalen med en kort oppdatering.</p>
          </div>
        ) : null}

        {messages.map((message, index) => {
          const isOwn = message.sender === viewerRole;
          const prev = index > 0 ? messages[index - 1] : null;
          const showDate = index === 0 || chatDateKey(message.createdAt) !== chatDateKey(prev?.createdAt ?? "");
          const showAvatar = !isOwn && (index === 0 || messages[index - 1]?.sender !== message.sender);
          return (
            <div key={message.id}>
              {showDate ? <div className="motus-chat-date-separator">{formatChatDateLabel(message.createdAt)}</div> : null}
              <MessageBubble
                message={message}
                isOwn={isOwn}
                showAvatar={showAvatar}
                counterpartyName={counterpartyName}
                counterpartyAvatarUrl={counterpartyAvatarUrl}
                viewerRole={viewerRole}
                isNewest={index === messages.length - 1}
                onReactionChange={() => setReactionVersion((value) => value + 1)}
              />
            </div>
          );
        })}
      </div>

      <footer className="motus-chat-footer">
        <div className="motus-chat-quick-replies scrollbar-none">
          {CHAT_REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="motus-chat-emoji-chip motus-pressable"
              onClick={() => onComposeChange(`${composeValue}${emoji}`)}
              aria-label={`Legg til ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          {resolvedQuickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              className="motus-chat-quick-reply motus-pressable"
              onClick={() => onComposeChange(reply)}
            >
              {reply}
            </button>
          ))}
        </div>

        {sendStatus ? (
          <div className={`motus-chat-status ${sendStatus.startsWith("Melding sendt") ? "motus-chat-status--ok" : "motus-chat-status--error"}`}>
            {sendStatus}
          </div>
        ) : null}

        <div className="motus-chat-compose">
          <button type="button" className="motus-chat-compose-icon motus-pressable" aria-label="Legg ved">
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            value={composeValue}
            onChange={(event) => onComposeChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={composePlaceholder}
            className="motus-chat-input"
          />
          <button type="button" className="motus-chat-compose-icon motus-pressable" aria-label="Emoji">
            <Smile className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="motus-chat-send motus-pressable"
            onClick={handleSend}
            disabled={sendDisabled || isSending || !composeValue.trim()}
            aria-label={isSending ? "Sender" : "Send"}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}

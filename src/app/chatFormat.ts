export function parseChatCreatedAtMs(value: string): number {
  if (!value) return 0;
  const isoCandidate = new Date(value);
  if (!Number.isNaN(isoCandidate.getTime())) return isoCandidate.getTime();
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+kl\s+(\d{2}):(\d{2}))?$/i);
  if (!match) return 0;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const hours = Number(match[4] ?? "0");
  const minutes = Number(match[5] ?? "0");
  const parsed = new Date(year, month, day, hours, minutes);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function formatChatTime(value: string): string {
  const ms = parseChatCreatedAtMs(value);
  if (ms <= 0) {
    const timeMatch = value.match(/(\d{1,2}:\d{2})/);
    return timeMatch?.[1] ?? value;
  }
  return new Date(ms).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}

export function formatChatDateLabel(value: string): string {
  const ms = parseChatCreatedAtMs(value);
  if (ms <= 0) return value;
  return new Date(ms).toLocaleDateString("nb-NO", { day: "numeric", month: "long" });
}

export function chatDateKey(value: string): string {
  const ms = parseChatCreatedAtMs(value);
  if (ms <= 0) return value.trim();
  const date = new Date(ms);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function buildShareProgramChatMessage(input: {
  programTitle: string;
  goal?: string;
  sender: "trainer" | "member";
}): string {
  const title = input.programTitle.trim() || "Program";
  if (input.sender === "trainer") {
    const goalLine = input.goal?.trim() ? `\nMål: ${input.goal.trim()}` : "";
    return `📋 Her er programmet ditt: «${title}»${goalLine}\n\nDu finner det under Trening → Mine programmer. Si fra om noe skal justeres!`;
  }
  return `Hei! Jeg holder på med «${title}» nå. Gi beskjed om du vil justere noe i programmet.`;
}

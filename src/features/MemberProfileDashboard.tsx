import { useRef, type ReactNode } from "react";
import {
  Calendar,
  Camera,
  ChevronRight,
  Dumbbell,
  Flame,
  HeartPulse,
  Mail,
  MessageSquare,
  Phone,
  Target,
  Timer,
  User,
} from "lucide-react";
import { MOTUS } from "../app/data";
import { MEMBER_GOAL_OPTIONS } from "../app/memberGoals";
import type { WorkoutLog } from "../app/types";
import { GradientButton, OutlineButton, SelectBox, StatusMessage, TextArea, TextInput } from "../app/ui";

function formatMemberSince(invitedAt: string): string {
  const trimmed = invitedAt.trim();
  if (!trimmed) return "—";
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;
  try {
    const formatted = new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" }).format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return trimmed;
  }
}

function formatLastWorkoutLabel(log: WorkoutLog | null): string {
  if (!log) return "Ingen fullførte økter ennå";
  return `${log.date} · ${log.programTitle}`;
}

function formatStreakValue(streakWeeks: number): string {
  if (streakWeeks <= 0) return "0 uker";
  if (streakWeeks === 1) return "1 uke på rad";
  return `${streakWeeks} uker på rad`;
}

type MemberProfileDashboardProps = {
  memberFirstName: string;
  memberAvatarUrl: string;
  onAvatarFileSelected: (file: File | null) => void;
  onRemoveAvatar: () => void;
  customerStatusLabel: string;
  latestCompletedLog: WorkoutLog | null;
  memberNameDraft: string;
  setMemberNameDraft: (value: string) => void;
  memberEmailDraft: string;
  setMemberEmailDraft: (value: string) => void;
  memberPhoneDraft: string;
  setMemberPhoneDraft: (value: string) => void;
  memberBirthDateDraft: string;
  setMemberBirthDateDraft: (value: string) => void;
  memberGoalDraft: string;
  setMemberGoalDraft: (value: string) => void;
  memberInjuriesDraft: string;
  setMemberInjuriesDraft: (value: string) => void;
  streakWeeks: number;
  streakSubline: string;
  totalWorkouts: number;
  memberSince: string;
  onOpenProgress: () => void;
  onSaveProfile: () => void;
  profileSaveInfo: string | null;
  isMemberLimited: boolean;
  onOpenOnboarding?: () => void;
  showOnboardingHomePrompt?: boolean;
  onboardingSubstantivelyComplete?: boolean;
  ptChangeReason: string;
  setPtChangeReason: (value: string) => void;
  onRequestPtChange: () => void;
  isSendingMemberMessage: boolean;
  ptChangeRequestStatus: string | null;
  onOpenMessages: () => void;
  restCountdownEnabled: boolean;
  setRestCountdownEnabled: (value: boolean) => void;
  microCelebrationsEnabled: boolean;
  setMicroCelebrationsEnabled: (value: boolean) => void;
  celebrationSoundEnabled: boolean;
  setCelebrationSoundEnabled: (value: boolean) => void;
  showWebPushSettings: boolean;
  onRegisterWebPush: () => void;
  pushRegisterBusy: boolean;
  pushRegisterStatus: string | null;
};

export function MemberProfileDashboard({
  memberFirstName,
  memberAvatarUrl,
  onAvatarFileSelected,
  onRemoveAvatar,
  customerStatusLabel,
  latestCompletedLog,
  memberNameDraft,
  setMemberNameDraft,
  memberEmailDraft,
  setMemberEmailDraft,
  memberPhoneDraft,
  setMemberPhoneDraft,
  memberBirthDateDraft,
  setMemberBirthDateDraft,
  memberGoalDraft,
  setMemberGoalDraft,
  memberInjuriesDraft,
  setMemberInjuriesDraft,
  streakWeeks,
  streakSubline,
  totalWorkouts,
  memberSince,
  onOpenProgress,
  onSaveProfile,
  profileSaveInfo,
  isMemberLimited,
  onOpenOnboarding,
  showOnboardingHomePrompt,
  onboardingSubstantivelyComplete,
  ptChangeReason,
  setPtChangeReason,
  onRequestPtChange,
  isSendingMemberMessage,
  ptChangeRequestStatus,
  onOpenMessages,
  restCountdownEnabled,
  setRestCountdownEnabled,
  microCelebrationsEnabled,
  setMicroCelebrationsEnabled,
  celebrationSoundEnabled,
  setCelebrationSoundEnabled,
  showWebPushSettings,
  onRegisterWebPush,
  pushRegisterBusy,
  pushRegisterStatus,
}: MemberProfileDashboardProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="motus-profile-dashboard motus-fade-in-up">
      <section className="motus-profile-header">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="relative shrink-0">
              <div className="relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-full ring-[3px] ring-white shadow-[0_4px_16px_-6px_rgba(48,227,190,0.55)]">
                {memberAvatarUrl ? (
                  <img src={memberAvatarUrl} alt="" className="h-full w-full object-cover" loading="eager" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xl font-bold text-white" style={{ background: MOTUS.gradient }}>
                    {memberFirstName.charAt(0).toUpperCase() || "?"}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="motus-pressable absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#D91278] text-white shadow-md"
                aria-label="Endre profilbilde"
              >
                <Camera className="h-3.5 w-3.5" aria-hidden />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => onAvatarFileSelected(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-slate-950">Hei {memberFirstName}! 👋</h2>
              <p className="mt-0.5 text-sm text-slate-600">Ditt personlige treningsdashboard</p>
            </div>
          </div>
        </div>
        {memberAvatarUrl ? (
          <button type="button" onClick={onRemoveAvatar} className="mt-3 text-xs font-medium text-[#D91278] hover:underline">
            Fjern profilbilde
          </button>
        ) : null}
      </section>

      <div className="motus-profile-status-grid">
        <div className="motus-profile-status-card">
          <div className="flex items-start gap-2.5">
            <span className="motus-profile-status-icon" aria-hidden>
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</p>
              <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-900">{customerStatusLabel}</p>
            </div>
          </div>
        </div>
        <div className="motus-profile-status-card">
          <div className="flex items-start gap-2.5">
            <span className="motus-profile-status-icon motus-profile-status-icon--pink" aria-hidden>
              <Timer className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Siste trening</p>
              <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-900">{formatLastWorkoutLabel(latestCompletedLog)}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="motus-profile-panel">
        <h3 className="text-sm font-semibold text-slate-900">Om meg</h3>
        <div className="mt-3 space-y-0">
          <ProfileInfoRow icon={User} label="Navn">
            <TextInput value={memberNameDraft} onChange={(e) => setMemberNameDraft(e.target.value)} placeholder="Navn" className="motus-profile-field" />
          </ProfileInfoRow>
          <ProfileInfoRow icon={Mail} label="E-post">
            <TextInput value={memberEmailDraft} onChange={(e) => setMemberEmailDraft(e.target.value)} placeholder="E-post" className="motus-profile-field" />
          </ProfileInfoRow>
          <ProfileInfoRow icon={Phone} label="Telefon">
            <TextInput value={memberPhoneDraft} onChange={(e) => setMemberPhoneDraft(e.target.value)} placeholder="Telefon" className="motus-profile-field" />
          </ProfileInfoRow>
          <ProfileInfoRow icon={Calendar} label="Fødselsdato">
            <TextInput
              value={memberBirthDateDraft}
              onChange={(e) => setMemberBirthDateDraft(e.target.value)}
              placeholder="dd.mm.yyyy"
              className="motus-profile-field"
            />
          </ProfileInfoRow>
          <ProfileInfoRow icon={Target} label="Mål">
            <SelectBox
              value={MEMBER_GOAL_OPTIONS.includes(memberGoalDraft as (typeof MEMBER_GOAL_OPTIONS)[number]) ? memberGoalDraft : ""}
              onChange={setMemberGoalDraft}
              className="motus-profile-field !h-9"
              options={[{ value: "", label: "Velg mål" }, ...MEMBER_GOAL_OPTIONS.map((goal) => ({ value: goal, label: goal }))]}
            />
          </ProfileInfoRow>
          <ProfileInfoRow icon={HeartPulse} label="Skader / hensyn">
            <TextArea
              value={memberInjuriesDraft}
              onChange={(e) => setMemberInjuriesDraft(e.target.value)}
              className="motus-profile-field min-h-[4.5rem] resize-none"
              placeholder="Skader, hensyn eller annet PT bør vite"
            />
          </ProfileInfoRow>
        </div>
      </section>

      {!isMemberLimited ? (
        <div className="motus-profile-cta-card">
          <div className="flex items-start gap-3">
            <span className="motus-profile-cta-icon" aria-hidden>
              <Target className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Dine mål, din fremgang</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">Se streak, badges og personlige rekorder samlet på ett sted.</p>
              <button type="button" onClick={onOpenProgress} className="motus-profile-cta-button motus-pressable mt-3 inline-flex items-center gap-1.5">
                Se mine mål og fremskritt
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="motus-profile-stats-grid">
        <ProfileStatCard icon={Flame} label="Streak" value={formatStreakValue(streakWeeks)} hint={streakSubline} tone="pink" />
        <ProfileStatCard icon={Calendar} label="Medlem siden" value={formatMemberSince(memberSince)} tone="mint" />
        <ProfileStatCard icon={Dumbbell} label="Totalt økter" value={String(totalWorkouts)} tone="pink" />
      </div>

      <div className="motus-profile-settings space-y-4">
        {onOpenOnboarding ? (
          <div className="motus-profile-panel">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Oppstartsskjema</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {showOnboardingHomePrompt || !onboardingSubstantivelyComplete
                    ? "Fyll ut én gang — PT bruker svarene til å tilpasse programmet ditt."
                    : "Oppdater svarene når mål eller hensyn endrer seg."}
                </p>
              </div>
              <GradientButton type="button" onClick={onOpenOnboarding} className="w-full shrink-0 sm:w-auto">
                {showOnboardingHomePrompt || !onboardingSubstantivelyComplete ? "Start skjema" : "Åpne skjema"}
              </GradientButton>
            </div>
          </div>
        ) : null}

        {!isMemberLimited ? (
          <div className="motus-profile-panel space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Behov for å bytte PT?</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">Send en forespørsel — byttet bekreftes av PT/admin.</p>
            </div>
            <TextArea
              value={ptChangeReason}
              onChange={(event) => setPtChangeReason(event.target.value)}
              className="min-h-[4.5rem] resize-none"
              placeholder="Kort forklaring (valgfritt)"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <GradientButton type="button" onClick={onRequestPtChange} disabled={isSendingMemberMessage} className="w-full sm:w-auto">
                {isSendingMemberMessage ? "Sender…" : "Be om PT-bytte"}
              </GradientButton>
              <OutlineButton type="button" onClick={onOpenMessages} className="w-full sm:w-auto">
                <MessageSquare className="mr-1.5 h-4 w-4" aria-hidden />
                Meldinger
              </OutlineButton>
            </div>
            {ptChangeRequestStatus ? (
              <StatusMessage
                message={ptChangeRequestStatus}
                tone={ptChangeRequestStatus.toLowerCase().includes("kunne ikke") ? "error" : "success"}
                className="!rounded-xl !px-3 !py-2 !text-xs"
              />
            ) : null}
          </div>
        ) : null}

        {!isMemberLimited ? (
          <div className="motus-profile-panel space-y-2">
            <p className="text-sm font-semibold text-slate-900">Innstillinger</p>
            <SettingToggle label="Pausenedtelling etter sett" checked={restCountdownEnabled} onChange={setRestCountdownEnabled} />
            <SettingToggle label="Melding ved nytt fremdriftsnivå" checked={microCelebrationsEnabled} onChange={setMicroCelebrationsEnabled} />
            <SettingToggle label="Lyd når du setter ny PR" checked={celebrationSoundEnabled} onChange={setCelebrationSoundEnabled} />
          </div>
        ) : null}

        {showWebPushSettings ? (
          <div className="motus-profile-panel space-y-2">
            <p className="text-sm font-semibold text-slate-900">Varsler på denne enheten</p>
            <p className="text-xs text-slate-600">Få beskjed når treneren sender deg en ny melding.</p>
            <OutlineButton type="button" onClick={onRegisterWebPush} disabled={pushRegisterBusy} className="w-full sm:w-auto">
              {pushRegisterBusy ? "Aktiverer…" : "Slå på push-varsler"}
            </OutlineButton>
            {pushRegisterStatus ? (
              <StatusMessage
                message={pushRegisterStatus}
                tone={pushRegisterStatus.startsWith("Push-varsler er") ? "success" : "error"}
                className="!rounded-xl !px-3 !py-2 !text-xs"
              />
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <GradientButton onClick={onSaveProfile} className="w-full sm:w-auto">
            Lagre endringer
          </GradientButton>
          {profileSaveInfo ? (
            <StatusMessage
              message={profileSaveInfo}
              tone={profileSaveInfo.toLowerCase().includes("feilet") ? "error" : "success"}
              className="!rounded-xl !px-3 !py-2 !text-xs"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProfileInfoRow({ icon: Icon, label, children }: { icon: typeof User; label: string; children: ReactNode }) {
  return (
    <div className="motus-profile-info-row">
      <span className="motus-profile-info-icon" aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

function ProfileStatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  hint?: string;
  tone: "mint" | "pink";
}) {
  return (
    <div className={`motus-profile-stat-card motus-profile-stat-card--${tone}`}>
      <span className="motus-profile-stat-card-icon" aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold leading-tight text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-sm text-slate-700">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#30E3BE]" />
    </label>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserCircle2 } from "lucide-react";
import { MOTUS } from "../app/data";
import { emptyTrainerProfile, type TrainerProfile } from "../app/trainerProfile";
import type { AuthUser } from "../app/types";
import { GradientButton, OutlineButton, StatusMessage, TextArea, TextInput } from "../app/ui";
import type { SaveTrainerProfileInput, SaveTrainerProfileResult } from "../services/supabaseAuth";

const CARD_ACTION_BTN = "!min-h-8 !px-2.5 !py-1.5 !text-xs !rounded-md";

type TrainerProfileCardProps = {
  loadProfile: () => Promise<{ name: string; email: string; profile: TrainerProfile }>;
  saveProfile: (input: SaveTrainerProfileInput) => Promise<SaveTrainerProfileResult>;
  onProfileSaved?: (user: AuthUser) => void;
};

export function TrainerProfileCard({ loadProfile, saveProfile, onProfileSaved }: TrainerProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [savedName, setSavedName] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [savedProfile, setSavedProfile] = useState<TrainerProfile>(emptyTrainerProfile());

  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editFocus, setEditFocus] = useState("");
  const [editBio, setEditBio] = useState("");

  const resetDraftFromSaved = useCallback(() => {
    setEditName(savedName);
    setEditPhone(savedProfile.phone);
    setEditTitle(savedProfile.title);
    setEditFocus(savedProfile.focus);
    setEditBio(savedProfile.bio);
  }, [savedName, savedProfile]);

  const refreshProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = await loadProfile();
      setSavedName(loaded.name);
      setSavedEmail(loaded.email);
      setSavedProfile(loaded.profile);
      setEditName(loaded.name);
      setEditPhone(loaded.profile.phone);
      setEditTitle(loaded.profile.title);
      setEditFocus(loaded.profile.focus);
      setEditBio(loaded.profile.bio);
    } finally {
      setIsLoading(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const hasUnsavedChanges = useMemo(() => {
    if (!isEditing) return false;
    return (
      editName.trim() !== savedName.trim() ||
      editPhone.trim() !== savedProfile.phone ||
      editTitle.trim() !== savedProfile.title ||
      editFocus.trim() !== savedProfile.focus ||
      editBio.trim() !== savedProfile.bio
    );
  }, [editBio, editFocus, editName, editPhone, editTitle, isEditing, savedName, savedProfile]);

  async function handleSave() {
    setIsSaving(true);
    setStatus(null);
    const result = await saveProfile({
      name: editName,
      profile: {
        phone: editPhone,
        title: editTitle,
        focus: editFocus,
        bio: editBio,
      },
    });
    setIsSaving(false);
    if (!result.ok) {
      setStatus(result.message);
      return;
    }
    setSavedName(result.user.name);
    setSavedEmail(result.user.email);
    const nextProfile = {
      phone: editPhone.trim(),
      title: editTitle.trim(),
      focus: editFocus.trim(),
      bio: editBio.trim(),
    };
    setSavedProfile(nextProfile);
    setIsEditing(false);
    setStatus(result.message);
    onProfileSaved?.(result.user);
  }

  if (isLoading) {
    return (
      <div className="rounded-[26px] p-5 text-white shadow-lg" style={{ background: MOTUS.gradient }}>
        <div className="text-sm text-white/80">PT-kort</div>
        <p className="mt-3 text-sm text-white/90">Laster profil…</p>
      </div>
    );
  }

  return (
    <div className="rounded-[26px] p-5 text-white shadow-lg" style={{ background: MOTUS.gradient }}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="text-sm text-white/80">PT-kort</div>
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-white/15 text-white/90 sm:h-14 sm:w-14">
          <UserCircle2 className="h-8 w-8 sm:h-9 sm:w-9" aria-hidden />
        </div>
      </div>
      <p className="text-xs text-white/75">Dette er din profil — kundene ser navnet ditt som «Din PT er …» i appen.</p>

      {isEditing ? (
        <div className="mt-3 space-y-3 rounded-2xl border border-white/25 bg-white/10 p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-white">
              <span>Navn</span>
              <TextInput value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="f.eks. Lene Ruud" />
            </label>
            <label className="space-y-1 text-xs font-medium text-white">
              <span>E-post (innlogging)</span>
              <TextInput value={savedEmail} readOnly disabled className="opacity-80" />
            </label>
            <label className="space-y-1 text-xs font-medium text-white">
              <span>Telefon</span>
              <TextInput value={editPhone} onChange={(event) => setEditPhone(event.target.value)} placeholder="f.eks. 900 00 000" />
            </label>
            <label className="space-y-1 text-xs font-medium text-white">
              <span>Tittel / rolle</span>
              <TextInput value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="f.eks. Personlig trener" />
            </label>
          </div>
          <label className="space-y-1 text-xs font-medium text-white">
            <span>Fokus / spesialitet</span>
            <TextInput value={editFocus} onChange={(event) => setEditFocus(event.target.value)} placeholder="f.eks. Styrke, rehab, kondisjon" />
          </label>
          <label className="space-y-1 text-xs font-medium text-white">
            <span>Kort om deg</span>
            <TextArea
              value={editBio}
              onChange={(event) => setEditBio(event.target.value)}
              className="min-h-[90px]"
              placeholder="Erfaring, tilnærming eller annet du vil ha oversikt over selv."
            />
          </label>
        </div>
      ) : (
        <>
          <div className="mt-1 text-2xl font-bold tracking-tight">{savedName || "Navn ikke satt"}</div>
          {savedProfile.title ? <div className="mt-1 text-sm font-medium text-white/90">{savedProfile.title}</div> : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm">
              <div className="text-[11px] text-white/70">E-post</div>
              <div className="font-medium text-white/95">{savedEmail || "Ikke satt"}</div>
            </div>
            <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm">
              <div className="text-[11px] text-white/70">Telefon</div>
              <div className="font-medium text-white/95">{savedProfile.phone || "Ikke satt"}</div>
            </div>
          </div>
          {savedProfile.focus ? (
            <div className="mt-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm">
              <div className="text-[11px] text-white/70">Fokus</div>
              <div className="font-medium text-white/95">{savedProfile.focus}</div>
            </div>
          ) : null}
          <div className="mt-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm">
            <div className="text-[11px] text-white/70">Kort om deg</div>
            <div className="font-medium text-white/95">{savedProfile.bio || "Ikke fylt ut"}</div>
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {isEditing ? (
          <>
            <GradientButton onClick={() => void handleSave()} disabled={isSaving} className={`${CARD_ACTION_BTN} w-full sm:w-auto`}>
              {isSaving ? "Lagrer…" : "Lagre"}
            </GradientButton>
            <OutlineButton
              onClick={() => {
                resetDraftFromSaved();
                setIsEditing(false);
                setStatus(null);
              }}
              className={`${CARD_ACTION_BTN} w-full sm:w-auto`}
            >
              Avbryt
            </OutlineButton>
          </>
        ) : (
          <OutlineButton onClick={() => setIsEditing(true)} className={`${CARD_ACTION_BTN} w-full sm:w-auto`}>
            Rediger
          </OutlineButton>
        )}
      </div>

      {status ? (
        <StatusMessage
          message={status}
          tone={status.toLowerCase().includes("lagret") ? "success" : "error"}
          className="mt-3 !rounded-xl !px-3 !py-2 !text-sm"
        />
      ) : null}
      {isEditing && hasUnsavedChanges ? (
        <p className="mt-2 text-[11px] text-white/75">Du har ulagrede endringer.</p>
      ) : null}
    </div>
  );
}

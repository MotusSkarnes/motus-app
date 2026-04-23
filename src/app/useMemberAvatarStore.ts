import { useEffect, useMemo, useState } from "react";
import type { AuthUser, Member } from "./types";
import { supabaseClient } from "../services/supabaseClient";

const MEMBER_AVATAR_BUCKET = "exercise-images";
const MEMBER_AVATAR_PREFIX = "member-avatars";

function encodeEmailForPath(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return "";
  const base64 = btoa(unescape(encodeURIComponent(normalized)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeEmailFromPath(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "";
  const padded = normalized.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    return decodeURIComponent(escape(atob(padded))).trim().toLowerCase();
  } catch {
    return "";
  }
}

function decodeNameFromPath(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "";
  const padded = normalized.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    return decodeURIComponent(escape(atob(padded))).trim().toLowerCase();
  } catch {
    return "";
  }
}

export function useMemberAvatarStore({
  currentUser,
  members,
  memberViewId,
}: {
  currentUser: AuthUser | null;
  members: Member[];
  memberViewId: string;
}) {
  function emailAvatarKey(email: string): string {
    const normalized = email.trim().toLowerCase();
    return normalized ? `email:${normalized}` : "";
  }
  function nameAvatarKey(name: string): string {
    const normalized = name.trim().toLowerCase();
    return normalized ? `name:${normalized}` : "";
  }

  const [memberAvatarById, setMemberAvatarById] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem("motus.member.avatarById");
      const parsed = JSON.parse(raw ?? "{}") as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
      );
    } catch {
      return {};
    }
  });

  const currentMemberAvatarTargetIds = useMemo(() => {
    if (!currentUser || currentUser.role !== "member") return [] as string[];
    const normalizedEmail = currentUser.email.trim().toLowerCase();
    if (!normalizedEmail) return [memberViewId].filter(Boolean);
    const ids = members
      .filter((member) => member.email.trim().toLowerCase() === normalizedEmail)
      .map((member) => member.id);
    return ids.length ? ids : [memberViewId].filter(Boolean);
  }, [currentUser, members, memberViewId]);

  const currentMemberAvatarUrl = useMemo(() => {
    const direct = memberAvatarById[memberViewId];
    if (direct) return direct;
    const directByEmail = currentUser?.email ? memberAvatarById[emailAvatarKey(currentUser.email)] : "";
    if (directByEmail) return directByEmail;
    const directByName = currentUser?.name ? memberAvatarById[nameAvatarKey(currentUser.name)] : "";
    if (directByName) return directByName;
    for (const memberId of currentMemberAvatarTargetIds) {
      const avatar = memberAvatarById[memberId];
      if (avatar) return avatar;
    }
    return "";
  }, [memberAvatarById, memberViewId, currentMemberAvatarTargetIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("motus.member.avatarById", JSON.stringify(memberAvatarById));
    } catch {
      // Avoid runtime crash if storage quota is exceeded.
    }
  }, [memberAvatarById]);

  useEffect(() => {
    if (!supabaseClient) return;
    let cancelled = false;
    async function hydrateRemoteAvatars() {
      const { data, error } = await supabaseClient.storage.from(MEMBER_AVATAR_BUCKET).list(MEMBER_AVATAR_PREFIX, { limit: 500 });
      if (cancelled || error || !data?.length) return;
      setMemberAvatarById((prev) => {
        let changed = false;
        const next = { ...prev };
        data.forEach((entry) => {
          const path = `${MEMBER_AVATAR_PREFIX}/${entry.name}`;
          const { data: publicData } = supabaseClient.storage.from(MEMBER_AVATAR_BUCKET).getPublicUrl(path);
          if (!publicData.publicUrl) return;
          const versionedUrl = `${publicData.publicUrl}?v=${entry.updated_at ?? entry.created_at ?? Date.now()}`;
          const dotIndex = entry.name.lastIndexOf(".");
          const rawName = dotIndex >= 0 ? entry.name.slice(0, dotIndex) : entry.name;
          const emailEncoded = rawName.startsWith("email-") ? rawName.slice("email-".length) : rawName;
          const nameEncoded = rawName.startsWith("name-") ? rawName.slice("name-".length) : "";
          const decodedEmail = decodeEmailFromPath(emailEncoded);
          const decodedName = decodeNameFromPath(nameEncoded);
          let didSet = false;
          if (decodedEmail) {
            const emailKey = emailAvatarKey(decodedEmail);
            if (next[emailKey] !== versionedUrl) {
              next[emailKey] = versionedUrl;
              didSet = true;
            }
          }
          if (decodedName) {
            const nameKey = nameAvatarKey(decodedName);
            if (next[nameKey] !== versionedUrl) {
              next[nameKey] = versionedUrl;
              didSet = true;
            }
          }
          if (!didSet && !decodedEmail && !decodedName) return;
          changed = true;
        });
        return changed ? next : prev;
      });
    }
    void hydrateRemoteAvatars();
    const intervalId = window.setInterval(() => {
      void hydrateRemoteAvatars();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [members, currentUser]);

  useEffect(() => {
    if (!members.length) return;
    setMemberAvatarById((prev) => {
      let changed = false;
      const next = { ...prev };
      members.forEach((member) => {
        const avatarUrl = member.avatarUrl?.trim() ?? "";
        if (!avatarUrl) return;
        if (!next[member.id]) {
          next[member.id] = avatarUrl;
          changed = true;
        }
        const emailKey = emailAvatarKey(member.email);
        if (emailKey && !next[emailKey]) {
          next[emailKey] = avatarUrl;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [members]);

  useEffect(() => {
    if (currentUser?.role !== "member") return;
    if (!currentMemberAvatarUrl) return;
    if (!currentMemberAvatarTargetIds.length) return;
    setMemberAvatarById((prev) => {
      let hasChanges = false;
      const next = { ...prev };
      currentMemberAvatarTargetIds.forEach((memberId) => {
        if (!memberId) return;
        if (next[memberId] === currentMemberAvatarUrl) return;
        next[memberId] = currentMemberAvatarUrl;
        hasChanges = true;
      });
      return hasChanges ? next : prev;
    });
  }, [currentUser, currentMemberAvatarUrl, currentMemberAvatarTargetIds]);

  function setMemberAvatarUrlForMember(memberId: string, avatarUrl: string) {
    setMemberAvatarById((prev) => {
      const targetMember = members.find((member) => member.id === memberId);
      if (!targetMember) return prev;
      const normalizedEmail = targetMember.email.trim().toLowerCase();
      const normalizedName = targetMember.name.trim().toLowerCase();
      const relatedIds = normalizedEmail
        ? members.filter((member) => member.email.trim().toLowerCase() === normalizedEmail).map((member) => member.id)
        : [memberId];
      const relatedNameIds = normalizedName
        ? members.filter((member) => member.name.trim().toLowerCase() === normalizedName).map((member) => member.id)
        : [];
      const emailKey = emailAvatarKey(normalizedEmail);
      const nameKey = nameAvatarKey(normalizedName);
      const uniqueIds = Array.from(new Set([...(relatedIds.length ? relatedIds : [memberId]), ...relatedNameIds]));
      const next = { ...prev };
      uniqueIds.forEach((id) => {
        next[id] = avatarUrl;
      });
      if (emailKey) {
        next[emailKey] = avatarUrl;
      }
      if (nameKey) {
        next[nameKey] = avatarUrl;
      }
      if (normalizedEmail) {
        const encodedEmail = encodeEmailForPath(normalizedEmail);
        if (encodedEmail) {
          const extension = avatarUrl.includes(".webp") ? "webp" : avatarUrl.includes(".png") ? "png" : "jpg";
          const path = `${MEMBER_AVATAR_PREFIX}/${encodedEmail}.${extension}`;
          const { data } = supabaseClient?.storage.from(MEMBER_AVATAR_BUCKET).getPublicUrl(path) ?? { data: null };
          if (data?.publicUrl) {
            next[emailKey] = data.publicUrl;
          }
        }
      }
      return next;
    });
  }

  function setCurrentMemberAvatarUrl(url: string) {
    setMemberAvatarById((prev) => {
      if (url) {
        const next = { ...prev };
        const currentEmailKey = currentUser?.email ? emailAvatarKey(currentUser.email) : "";
        const currentNameKey = currentUser?.name ? nameAvatarKey(currentUser.name) : "";
        currentMemberAvatarTargetIds.forEach((memberId) => {
          if (!memberId) return;
          next[memberId] = url;
        });
        if (!currentMemberAvatarTargetIds.length && memberViewId) {
          next[memberViewId] = url;
        }
        if (currentEmailKey) {
          next[currentEmailKey] = url;
        }
        if (currentNameKey) {
          next[currentNameKey] = url;
        }
        return next;
      }
      if (!currentMemberAvatarTargetIds.length && !memberViewId) return prev;
      const currentEmailKey = currentUser?.email ? emailAvatarKey(currentUser.email) : "";
      const currentNameKey = currentUser?.name ? nameAvatarKey(currentUser.name) : "";
      return Object.fromEntries(
        Object.entries(prev).filter(([key]) => {
          if (currentEmailKey && key === currentEmailKey) return false;
          if (currentNameKey && key === currentNameKey) return false;
          if (currentMemberAvatarTargetIds.length) {
            return !currentMemberAvatarTargetIds.includes(key);
          }
          return key !== memberViewId;
        })
      );
    });
  }

  return {
    memberAvatarById,
    currentMemberAvatarUrl,
    setMemberAvatarUrlForMember,
    setCurrentMemberAvatarUrl,
  };
}

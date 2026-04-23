import { useEffect, useMemo, useState } from "react";
import type { AuthUser, Member } from "./types";

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
      const relatedIds = normalizedEmail
        ? members.filter((member) => member.email.trim().toLowerCase() === normalizedEmail).map((member) => member.id)
        : [memberId];
      const emailKey = emailAvatarKey(normalizedEmail);
      const uniqueIds = Array.from(new Set(relatedIds.length ? relatedIds : [memberId]));
      const next = { ...prev };
      uniqueIds.forEach((id) => {
        next[id] = avatarUrl;
      });
      if (emailKey) {
        next[emailKey] = avatarUrl;
      }
      return next;
    });
  }

  function setCurrentMemberAvatarUrl(url: string) {
    setMemberAvatarById((prev) => {
      if (url) {
        const next = { ...prev };
        const currentEmailKey = currentUser?.email ? emailAvatarKey(currentUser.email) : "";
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
        return next;
      }
      if (!currentMemberAvatarTargetIds.length && !memberViewId) return prev;
      const currentEmailKey = currentUser?.email ? emailAvatarKey(currentUser.email) : "";
      return Object.fromEntries(
        Object.entries(prev).filter(([key]) => {
          if (currentEmailKey && key === currentEmailKey) return false;
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

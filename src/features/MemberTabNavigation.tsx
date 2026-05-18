import type { LucideIcon } from "lucide-react";
import { ClipboardList, LayoutDashboard, MessageSquare, Sparkles, TrendingUp, UserCircle2 } from "lucide-react";
import { MOTUS } from "../app/data";
import type { MemberTab } from "../app/types";
import { Card } from "../app/ui";

type MemberTabNavItem = { id: MemberTab; label: string; icon: LucideIcon };

export function memberNavTabs(isMemberLimited: boolean): MemberTabNavItem[] {
  if (isMemberLimited) {
    return [
      { id: "overview", label: "Hjem", icon: LayoutDashboard },
      { id: "programs", label: "Trening", icon: ClipboardList },
      { id: "inspiration", label: "Inspo", icon: Sparkles },
      { id: "profile", label: "Profil", icon: UserCircle2 },
    ];
  }
  return [
    { id: "overview", label: "Hjem", icon: LayoutDashboard },
    { id: "programs", label: "Trening", icon: ClipboardList },
    { id: "inspiration", label: "Inspo", icon: Sparkles },
    { id: "progress", label: "Fremgang", icon: TrendingUp },
    { id: "messages", label: "Meldinger", icon: MessageSquare },
    { id: "profile", label: "Profil", icon: UserCircle2 },
  ];
}

type MemberTabNavigationProps = {
  memberTab: MemberTab;
  setMemberTab: (tab: MemberTab) => void;
  isMemberLimited: boolean;
};

export function MemberDesktopTabNav({ memberTab, setMemberTab, isMemberLimited }: MemberTabNavigationProps) {
  const tabs = memberNavTabs(isMemberLimited);
  return (
    <Card className="hidden overflow-hidden lg:block">
      <div
        className="flex gap-2 overflow-auto px-3 py-3"
        style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
      >
        {tabs.map((tab) => {
          const isActive = memberTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMemberTab(tab.id)}
              className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-medium transition ${
                isActive ? "bg-white text-slate-900 shadow-sm" : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export function MemberMobileTabNav({ memberTab, setMemberTab, isMemberLimited }: MemberTabNavigationProps) {
  const tabs = memberNavTabs(isMemberLimited).filter((tab) => tab.id !== "profile");
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9999] border-t bg-white/95 px-2 pt-2 backdrop-blur lg:hidden"
      style={{ borderColor: "rgba(15,23,42,0.08)", paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="mx-auto flex max-w-md items-center gap-1.5 rounded-[22px] border bg-slate-50/90 p-1.5 shadow-lg"
        style={{ borderColor: "rgba(15,23,42,0.06)" }}
      >
        <div
          className="flex w-full items-center gap-1.5 rounded-[18px] p-1.5"
          style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = memberTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMemberTab(tab.id)}
                className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition ${
                  isActive ? "bg-white text-slate-900 shadow-sm" : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

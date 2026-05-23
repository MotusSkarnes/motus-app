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
      className="fixed inset-x-0 bottom-0 z-[9999] px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] lg:hidden"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(248,250,252,0.78) 38%, rgba(248,250,252,0.94) 100%)",
      }}
    >
      <div
        className="mx-auto flex max-w-md items-center rounded-[1.65rem] border bg-white/78 p-1.5 shadow-2xl shadow-slate-900/15 ring-1 ring-white/80 backdrop-blur-xl"
        style={{ borderColor: "rgba(15,23,42,0.08)" }}
      >
        <div
          className="flex w-full items-center gap-1 rounded-[1.25rem] bg-white/55 p-1"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)" }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = memberTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMemberTab(tab.id)}
                className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl px-2 py-2 text-[11px] font-bold transition duration-200 ${
                  isActive ? "scale-[1.03] text-slate-950 shadow-lg shadow-teal-500/18" : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
                }`}
                style={
                  isActive
                    ? {
                        background: "linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(252,231,243,0.88) 100%)",
                        boxShadow: "0 10px 26px rgba(20,184,166,0.18), inset 0 0 0 1px rgba(255,255,255,0.9)",
                      }
                    : undefined
                }
              >
                {isActive ? (
                  <span
                    className="pointer-events-none absolute inset-x-4 -top-3 h-7 rounded-full blur-xl"
                    style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                    aria-hidden
                  />
                ) : null}
                <Icon className={`${isActive ? "h-5 w-5" : "h-4 w-4"} relative shrink-0 transition-all duration-200`} strokeWidth={isActive ? 2.6 : 2.1} />
                <span className="relative truncate leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

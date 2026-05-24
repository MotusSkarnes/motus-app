import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ClipboardList, LayoutDashboard, MessageSquare, Sparkles, TrendingUp } from "lucide-react";
import { MOTUS } from "../app/data";
import { motusHaptic } from "../app/haptics";
import type { MemberTab } from "../app/types";
import { Card } from "../app/ui";

type MemberTabNavItem = { id: MemberTab; label: string; icon: LucideIcon };

export function memberNavTabs(isMemberLimited: boolean): MemberTabNavItem[] {
  if (isMemberLimited) {
    return [
      { id: "overview", label: "Hjem", icon: LayoutDashboard },
      { id: "programs", label: "Trening", icon: ClipboardList },
      { id: "inspiration", label: "Inspo", icon: Sparkles },
    ];
  }
  return [
    { id: "overview", label: "Hjem", icon: LayoutDashboard },
    { id: "programs", label: "Trening", icon: ClipboardList },
    { id: "inspiration", label: "Inspo", icon: Sparkles },
    { id: "progress", label: "Fremgang", icon: TrendingUp },
    { id: "messages", label: "Meldinger", icon: MessageSquare },
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
    <Card className="hidden overflow-hidden border-0 bg-[#F7F8FA] p-1 xl:block">
      <div className="flex flex-wrap gap-1 px-1 py-1">
        {tabs.map((tab) => {
          const isActive = memberTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMemberTab(tab.id)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
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

function MemberMobileTabButton({
  tab,
  memberTab,
  setMemberTab,
  className,
}: {
  tab: MemberTabNavItem;
  memberTab: MemberTab;
  setMemberTab: (tab: MemberTab) => void;
  className: string;
}) {
  const Icon = tab.icon;
  const isActive = memberTab === tab.id;

  function activateTab() {
    if (memberTab !== tab.id) motusHaptic("light");
    setMemberTab(tab.id);
  }

  return (
    <button
      type="button"
      onClick={activateTab}
      className={`motus-mobile-tab-button ${className} ${isActive ? "motus-mobile-tab-active rounded-xl bg-white/70 shadow-[0_1px_4px_-2px_rgba(15,23,42,0.12)]" : "text-slate-500"}`}
    >
      <Icon
        className="h-[22px] w-[22px] shrink-0"
        strokeWidth={isActive ? 2.5 : 2}
        style={isActive ? { color: MOTUS.turquoise } : undefined}
      />
      <span className="truncate leading-none">{tab.label}</span>
      {isActive ? (
        <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: MOTUS.turquoise }} aria-hidden />
      ) : (
        <span className="h-0.5 w-4" aria-hidden />
      )}
    </button>
  );
}

function MemberMobileTabBar({ memberTab, setMemberTab, isMemberLimited }: MemberTabNavigationProps) {
  const tabs = memberNavTabs(isMemberLimited);

  return (
    <nav
      className="motus-mobile-tab-bar fixed inset-x-0 bottom-0 z-[100001] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 xl:hidden"
      aria-label="Hovedmeny medlem"
    >
      <div className="mx-auto flex max-w-md items-stretch gap-0.5">
        {tabs.map((tab) => (
          <MemberMobileTabButton
            key={tab.id}
            tab={tab}
            memberTab={memberTab}
            setMemberTab={setMemberTab}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-semibold transition"
          />
        ))}
      </div>
    </nav>
  );
}

export function MemberMobileTabNav(props: MemberTabNavigationProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(<MemberMobileTabBar {...props} />, document.body);
}

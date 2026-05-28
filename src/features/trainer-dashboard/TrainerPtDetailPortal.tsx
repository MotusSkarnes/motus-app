import type { ReactNode } from "react";

const DETAIL_ROOT_ID = "motus-pt-detail-root";
export function TrainerPtDetailPortal({
  children,
  activeTab: _activeTab,
  syncKey: _syncKey,
}: {
  children: ReactNode;
  activeTab: string;
  syncKey?: string;
}) {
  // Emergency stability mode: avoid DOM portal/matchMedia runtime paths.
  return <div className="motus-pt-detail-inline">{children}</div>;
}

export { DETAIL_ROOT_ID };

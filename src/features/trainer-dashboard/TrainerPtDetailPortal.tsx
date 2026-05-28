import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const DETAIL_ROOT_ID = "motus-pt-detail-root";

const DESKTOP_QUERY = "(min-width: 1280px)";

function getDesktopMatch(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia(DESKTOP_QUERY).matches;
  } catch {
    return false;
  }
}

export function TrainerPtDetailPortal({
  children,
  activeTab,
  syncKey,
}: {
  children: ReactNode;
  activeTab: string;
  syncKey?: string;
}) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(() => getDesktopMatch());

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") {
      setIsDesktop(false);
      setPortalTarget(document.getElementById(DETAIL_ROOT_ID));
      return;
    }
    const media = window.matchMedia(DESKTOP_QUERY);
    const sync = () => {
      setIsDesktop(getDesktopMatch());
      setPortalTarget(document.getElementById(DETAIL_ROOT_ID));
    };
    sync();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
    } else if (typeof media.addListener === "function") {
      media.addListener(sync);
    }
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", sync);
      } else if (typeof media.removeListener === "function") {
        media.removeListener(sync);
      }
      observer.disconnect();
    };
  }, [activeTab, syncKey]);

  if (isDesktop) {
    if (!portalTarget) return null;
    return createPortal(
      <div className="motus-pt-detail-portaled" data-pt-detail-tab={activeTab}>
        {children}
      </div>,
      portalTarget,
    );
  }

  return <div className="motus-pt-detail-inline">{children}</div>;
}

export { DETAIL_ROOT_ID };

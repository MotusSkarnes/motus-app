import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const DETAIL_ROOT_ID = "motus-pt-detail-root";
const DESKTOP_QUERY = "(min-width: 1280px)";

export function TrainerPtDetailPortal({ children }: { children: ReactNode }) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(DESKTOP_QUERY);
    const sync = () => {
      setIsDesktop(media.matches);
      setPortalTarget(document.getElementById(DETAIL_ROOT_ID));
    };
    sync();
    media.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      media.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);

  if (isDesktop && portalTarget) {
    return createPortal(children, portalTarget);
  }

  return <div className="motus-pt-detail-inline">{children}</div>;
}

export { DETAIL_ROOT_ID };

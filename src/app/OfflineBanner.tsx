import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  useEffect(() => {
    function onOnline() {
      setOnline(true);
    }
    function onOffline() {
      setOnline(false);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm font-medium text-amber-950"
      role="status"
      aria-live="polite"
    >
      Du er offline. App-skal lastes fra cache; synk mot trener skjer når nettet er tilbake.
    </div>
  );
}

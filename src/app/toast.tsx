/* eslint-disable react-refresh/only-export-components */
import React from "react";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
  title?: string;
};

const ToastContext = React.createContext<{
  pushToast: (input: { message: string; tone?: ToastTone; title?: string }) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = React.useCallback((input: { message: string; tone?: ToastTone; title?: string }) => {
    const message = input.message.trim();
    if (!message) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev.filter((toast) => toast.message !== message), { id, message, tone: input.tone ?? "info", title: input.title }].slice(-4));
    window.setTimeout(() => dismissToast(id), 4200);
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-3 sm:top-4 sm:justify-end sm:px-4 md:px-8">
        <div className="flex w-full max-w-sm flex-col gap-2">
          {toasts.map((toast) => {
            const toneClass =
              toast.tone === "success"
                ? "motus-brand-surface"
                : toast.tone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-sky-200 bg-sky-50 text-sky-800";
            return (
              <div
                key={toast.id}
                className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-lg backdrop-blur motus-fade-in-up ${toneClass}`}
                style={{ boxShadow: "0 18px 40px rgba(15,23,42,0.12)" }}
              >
                {toast.title ? <div className="text-sm font-semibold">{toast.title}</div> : null}
                <div className={`text-sm ${toast.title ? "mt-0.5" : ""}`}>{toast.message}</div>
                <button type="button" onClick={() => dismissToast(toast.id)} className="mt-2 text-xs font-medium opacity-70 transition hover:opacity-100">
                  Lukk
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  return context ?? { pushToast: () => undefined };
}

export function useToastStatus(
  message: string | null | undefined,
  options?: {
    title?: string;
    tone?: ToastTone | ((message: string) => ToastTone);
    /** Når false, vises ikke toast (status kan fortsatt brukes i UI). */
    shouldToast?: (message: string) => boolean;
  },
) {
  const { pushToast } = useToast();
  const lastMessageRef = React.useRef("");
  const title = options?.title;
  const tone = options?.tone;
  const shouldToast = options?.shouldToast;

  React.useEffect(() => {
    const normalized = message?.trim() ?? "";
    if (!normalized) {
      lastMessageRef.current = "";
      return;
    }
    if (shouldToast && !shouldToast(normalized)) {
      lastMessageRef.current = normalized;
      return;
    }
    if (lastMessageRef.current === normalized) return;
    lastMessageRef.current = normalized;
    pushToast({ message: normalized, tone: typeof tone === "function" ? tone(normalized) : tone, title });
  }, [message, pushToast, title, tone, shouldToast]);
}

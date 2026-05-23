import React from "react";
import { MOTUS } from "./data";
import { ToastProvider } from "./toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="motus-page min-h-screen min-h-svh overflow-x-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-8 md:pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-[90rem]">{children}</div>
      </div>
    </ToastProvider>
  );
}

type CardVariant = "hero" | "standard" | "secondary";

const CARD_VARIANT_CLASS: Record<CardVariant, string> = {
  hero: "motus-card-hero",
  standard: "motus-card",
  secondary: "rounded-2xl border bg-[#F7F8FA]",
};

export function Card({
  children,
  className = "",
  variant = "standard",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`${CARD_VARIANT_CLASS[variant]} ${className}`}
      style={{ borderColor: "rgba(15,23,42,0.10)", ...style }}
    >
      {children}
    </div>
  );
}

export function MemberTabHero({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`motus-card-hero overflow-hidden ${className}`}>
      <div className="motus-hairline-accent mx-4 mt-4 sm:mx-6 sm:mt-6" aria-hidden />
      <div className="p-4 sm:p-6">
        <h2 className="max-w-3xl text-2xl font-bold leading-tight tracking-tight text-slate-950">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-600">{description}</p> : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </div>
  );
}

export function MotusSectionIcon({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`motus-icon-chip ${className}`}>{children}</span>;
}

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold" style={{ backgroundColor: MOTUS.paleMint, color: MOTUS.ink, borderColor: MOTUS.turquoise }}>{children}</span>;
}

export function PillButton({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`motus-pressable shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${active ? "text-white shadow-sm" : "text-slate-700 bg-slate-50 hover:bg-slate-100"}`}
      style={active ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : {}}
    >
      {children}
    </button>
  );
}

export function MobileNavButton({ active, icon, label, onClick }: { active?: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`motus-pressable flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-2 text-[10px] font-medium transition ${active ? "text-white shadow-sm" : "text-slate-600"}`}
      style={active ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : { backgroundColor: "transparent" }}
    >
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      <span className="truncate leading-none">{label}</span>
    </button>
  );
}

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function TextInput(props, ref) {
  return <input ref={ref} {...props} className={`h-10 w-full rounded-lg border px-3 text-sm outline-none ${props.className ?? ""}`} style={{ borderColor: "rgba(15,23,42,0.12)" }} />;
});

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(props, ref) {
  return <textarea ref={ref} {...props} className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none ${props.className ?? ""}`} style={{ borderColor: "rgba(15,23,42,0.12)" }} />;
});

type SelectOption = { value: string; label: string };

function triggerLightHaptic() {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  navigator.vibrate?.(8);
}

export function SelectBox({
  value,
  onChange,
  options,
  className = "",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<string | SelectOption>;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`h-10 w-full rounded-lg border px-3 text-sm text-slate-800 outline-none bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${className}`}
      style={{ borderColor: "rgba(15,23,42,0.12)" }}
    >
      {options.map((option) => {
        if (typeof option === "string") {
          return (
            <option key={option} value={option}>
              {option}
            </option>
          );
        }

        return (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        );
      })}
    </select>
  );
}

export function GradientButton({ children, className = "", type = "button", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return (
    <button
      type={type}
      {...props}
      onPointerDown={(event) => {
        props.onPointerDown?.(event);
        if (!props.disabled) triggerLightHaptic();
      }}
      className={`motus-pressable inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`, ...props.style }}
    >
      {children}
    </button>
  );
}

export function TrainingStartButton({
  children,
  className = "",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return (
    <button
      type={type}
      {...props}
      onPointerDown={(event) => {
        props.onPointerDown?.(event);
        if (!props.disabled) triggerLightHaptic();
      }}
      className={`motus-pressable motus-training-start-btn inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function OutlineButton({ children, className = "", type = "button", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return (
    <button
      type={type}
      {...props}
      className={`motus-pressable inline-flex min-h-10 items-center justify-center rounded-lg border bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      style={{ borderColor: "rgba(15,23,42,0.12)" }}
    >
      {children}
    </button>
  );
}

export function DangerButton({ children, className = "", type = "button", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return (
    <button
      type={type}
      {...props}
      className={`motus-pressable inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Bekreft",
  cancelLabel = "Avbryt",
  showCancel = true,
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  tone?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10050] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center sm:p-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-5 shadow-2xl sm:p-6" style={{ borderColor: "rgba(15,23,42,0.10)" }}>
        <div className="text-lg font-semibold tracking-tight text-slate-900">{title}</div>
        <div className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{message}</div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {showCancel ? (
            <OutlineButton onClick={onCancel} className="w-full sm:w-auto">
              {cancelLabel}
            </OutlineButton>
          ) : null}
          {tone === "danger" ? (
            <DangerButton onClick={onConfirm} className="w-full sm:w-auto">
              {confirmLabel}
            </DangerButton>
          ) : (
            <GradientButton onClick={onConfirm} className="w-full sm:w-auto">
              {confirmLabel}
            </GradientButton>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon = "🗂️",
  action,
  className = "",
}: {
  title: string;
  description: string;
  icon?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border bg-slate-50 px-4 py-5 text-center ${className}`} style={{ borderColor: "rgba(15,23,42,0.1)" }}>
      <div className="text-xl" aria-hidden>{icon}</div>
      <div className="mt-2 text-sm font-semibold text-slate-700">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{description}</div>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="motus-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-bold tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-[13px] text-slate-600">{hint}</div>
    </div>
  );
}

export function StatusMessage({
  message,
  tone = "info",
  className = "",
}: {
  message: string;
  tone?: "success" | "error" | "info";
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-sky-200 bg-sky-50 text-sky-700";
  return <div className={`motus-fade-in-up rounded-lg border px-4 py-3 text-sm ${toneClass} ${className}`}>{message}</div>;
}

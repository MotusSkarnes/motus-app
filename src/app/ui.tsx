import React from "react";
import { MOTUS } from "./data";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen min-h-dvh p-3 sm:p-4 md:p-8 text-slate-900 bg-white">
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border bg-white/95 shadow-sm ${className}`} style={{ borderColor: "rgba(15,23,42,0.06)" }}>{children}</div>;
}

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold" style={{ backgroundColor: MOTUS.paleMint, color: MOTUS.ink, borderColor: MOTUS.turquoise }}>{children}</span>;
}

export function PillButton({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-medium transition ${active ? "text-white" : "text-slate-700 bg-slate-50"}`}
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
      className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1.5 py-2 text-[10px] font-medium transition ${active ? "text-white shadow-sm" : "text-slate-600"}`}
      style={active ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : { backgroundColor: "transparent" }}
    >
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      <span className="truncate leading-none">{label}</span>
    </button>
  );
}

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function TextInput(props, ref) {
  return <input ref={ref} {...props} className={`h-11 w-full rounded-2xl border px-3 text-base outline-none ${props.className ?? ""}`} style={{ borderColor: "rgba(15,23,42,0.10)" }} />;
});

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-2xl border px-3 py-3 text-base outline-none ${props.className ?? ""}`} style={{ borderColor: "rgba(15,23,42,0.10)" }} />;
}

type SelectOption = { value: string; label: string };

export function SelectBox({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<string | SelectOption>;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-11 w-full rounded-2xl border px-3 text-base text-slate-800 outline-none bg-white ${className}`}
      style={{ borderColor: "rgba(15,23,42,0.10)" }}
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
  return <button type={type} {...props} className={`rounded-2xl px-4 py-2.5 text-sm font-medium text-white cursor-pointer ${className}`} style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>{children}</button>;
}

export function OutlineButton({ children, className = "", type = "button", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return <button type={type} {...props} className={`rounded-2xl border px-4 py-2.5 text-sm font-medium text-slate-700 bg-white cursor-pointer ${className}`} style={{ borderColor: "rgba(15,23,42,0.10)" }}>{children}</button>;
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl border p-4 shadow-sm relative overflow-hidden bg-white" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 78%, ${MOTUS.acid} 100%)` }} />
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
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
  return <div className={`motus-fade-in-up rounded-2xl border px-4 py-3 text-sm ${toneClass} ${className}`}>{message}</div>;
}

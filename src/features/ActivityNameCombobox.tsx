import { ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ACTIVITY_NAME_SUGGESTIONS, filterActivityNameSuggestions } from "../app/activityWorkoutLog";
import { TextInput } from "../app/ui";

type ActivityNameComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function ActivityNameCombobox({
  value,
  onChange,
  placeholder = "Velg eller skriv aktivitet",
  className = "",
}: ActivityNameComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => filterActivityNameSuggestions(value), [value]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function selectSuggestion(name: string) {
    onChange(name);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <TextInput
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="pr-9"
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-500"
          aria-label="Vis aktivitetsforslag"
          onMouseDown={(event) => {
            event.preventDefault();
            setOpen((prev) => !prev);
          }}
        >
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border bg-white py-1 shadow-lg"
          style={{ borderColor: "rgba(15,23,42,0.12)" }}
        >
          {suggestions.length > 0 ? (
            suggestions.map((name) => (
              <li key={name} role="option" aria-selected={value === name}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-emerald-50"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectSuggestion(name);
                  }}
                >
                  {name}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-xs text-slate-500">
              Ingen treff — du kan skrive fritt og lagre.
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { loadMealPlanForMember } from "../app/mealPlanStorage";
import { persistMealPlanLocalAndScheduleCloud } from "../app/mealPlanCloud";
import type { MealPlan } from "../app/mealPlanTypes";
import { pickCanonicalMemberRowForProfile } from "../app/memberOnboarding";
import type { Member } from "../app/types";
import { EmptyState, PillButton } from "../app/ui";
import { TrainerMealPlanEditor } from "./TrainerMealPlanEditor";
import "../foodbank.css";

type TrainerMealPlanHubViewProps = {
  members: Member[];
  selectedMemberId: string;
  onSelectMember: (memberId: string) => void;
  trainerOwnerUserId?: string;
  memberSearch: string;
  onMemberSearchChange: (value: string) => void;
};

type PlannerHubTab = "new" | "templates" | "history";
type MealPlanTemplateItem = {
  id: string;
  name: string;
  createdAt: string;
};

const MEAL_PLAN_TEMPLATE_LIST_KEY = "motus_meal_plan_templates_v1";
const DEFAULT_TEMPLATE_ID = "__mealplan_template_library__";

function readTemplateLibrary(): MealPlanTemplateItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MEAL_PLAN_TEMPLATE_LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const id = String(row.id ?? "").trim();
        const name = String(row.name ?? "").trim();
        if (!id || !name) return null;
        return {
          id,
          name,
          createdAt: String(row.createdAt ?? new Date().toISOString()),
        } as MealPlanTemplateItem;
      })
      .filter((item): item is MealPlanTemplateItem => item !== null);
  } catch {
    return [];
  }
}

function writeTemplateLibrary(items: MealPlanTemplateItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MEAL_PLAN_TEMPLATE_LIST_KEY, JSON.stringify(items));
}

function makeTemplateId(): string {
  return `__mealplan_template_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}__`;
}

function cloneTemplateToMember(templatePlan: MealPlan, memberId: string): MealPlan {
  return {
    ...templatePlan,
    id: `mealplan-${memberId}`,
    memberId,
    createdAt: templatePlan.createdAt || new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
  };
}

export function TrainerMealPlanHubView({
  members,
  selectedMemberId,
  onSelectMember,
  trainerOwnerUserId,
  memberSearch,
  onMemberSearchChange,
}: TrainerMealPlanHubViewProps) {
  const [hubTab, setHubTab] = useState<PlannerHubTab>("new");
  const [templates, setTemplates] = useState<MealPlanTemplateItem[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [templateAssignStatus, setTemplateAssignStatus] = useState<string | null>(null);

  useEffect(() => {
    const loaded = readTemplateLibrary();
    if (!loaded.length) {
      const fallback: MealPlanTemplateItem = {
        id: DEFAULT_TEMPLATE_ID,
        name: "Standard mal",
        createdAt: new Date().toISOString(),
      };
      setTemplates([fallback]);
      writeTemplateLibrary([fallback]);
      return;
    }
    setTemplates(loaded);
    setActiveTemplateId((prev) => (loaded.some((template) => template.id === prev) ? prev : loaded[0].id));
  }, []);

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === activeTemplateId) ?? templates[0] ?? null,
    [templates, activeTemplateId],
  );

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name, "nb"));
    if (!query) return sorted;
    return sorted.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.email.trim().toLowerCase().includes(query),
    );
  }, [members, memberSearch]);

  const selectedMember = useMemo(() => {
    if (!filteredMembers.length) return null;
    const direct = filteredMembers.find((member) => member.id === selectedMemberId);
    if (direct) return pickCanonicalMemberRowForProfile(direct, members);
    return pickCanonicalMemberRowForProfile(filteredMembers[0], members);
  }, [filteredMembers, members, selectedMemberId]);

  useEffect(() => {
    if (!filteredMembers.length) return;
    const stillVisible = filteredMembers.some((member) => member.id === selectedMemberId);
    if (!stillVisible) onSelectMember(filteredMembers[0].id);
  }, [filteredMembers, onSelectMember, selectedMemberId]);

  return (
    <div className="motus-foodbank motus-pt-planner-hub">
      <header className="motus-foodbank-header motus-pt-planner-hub__header">
        <div>
          <h1 className="motus-foodbank-title">Planlegg matplan</h1>
          <p className="motus-foodbank-subtitle">
            Bygg ukemeny i rutenett — medlemmet ser planen under Ernæring når tilgang er aktivert.
          </p>
        </div>
      </header>

      <div className="motus-pt-planner-hub__tabs">
        <PillButton active={hubTab === "new"} onClick={() => setHubTab("new")}>
          Lag ny plan
        </PillButton>
        <PillButton active={hubTab === "templates"} onClick={() => setHubTab("templates")}>
          Malbibliotek
        </PillButton>
        <PillButton active={hubTab === "history"} onClick={() => setHubTab("history")} disabled>
          Tidligere planer
        </PillButton>
      </div>

      {hubTab === "history" ? (
        <EmptyState
          icon="🍽️"
          title="Kommer snart"
          description="Historikk er under utvikling."
          className="mt-4"
        />
      ) : hubTab === "templates" ? (
        !activeTemplate ? (
          <EmptyState
            icon="🍽️"
            title="Ingen maler ennå"
            description="Opprett en ny kostholdsmal for å komme i gang."
            className="mt-4"
          />
        ) : (
          <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <aside className="space-y-2 lg:sticky lg:top-4 lg:self-start">
              <button
                type="button"
                onClick={() => {
                  const newTemplate: MealPlanTemplateItem = {
                    id: makeTemplateId(),
                    name: `Ny mal ${templates.length + 1}`,
                    createdAt: new Date().toISOString(),
                  };
                  const next = [...templates, newTemplate];
                  setTemplates(next);
                  writeTemplateLibrary(next);
                  setActiveTemplateId(newTemplate.id);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-900 transition hover:bg-teal-100"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Ny mal
              </button>
              <ul className="max-h-[min(70vh,28rem)] space-y-1 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm">
                {templates.map((template) => {
                  const active = template.id === activeTemplate.id;
                  return (
                    <li key={template.id}>
                      <button
                        type="button"
                        onClick={() => setActiveTemplateId(template.id)}
                        className={`flex w-full items-start rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          active ? "bg-teal-50 text-teal-950 ring-1 ring-teal-200" : "text-slate-800 hover:bg-slate-50"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{template.name}</span>
                          <span className="block truncate text-xs text-slate-500">Kostholdsmal</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!activeTemplate) return;
                    const copied: MealPlanTemplateItem = {
                      id: makeTemplateId(),
                      name: `${activeTemplate.name} (kopi)`,
                      createdAt: new Date().toISOString(),
                    };
                    const next = [...templates, copied];
                    setTemplates(next);
                    writeTemplateLibrary(next);
                    setActiveTemplateId(copied.id);
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-2 py-2 text-slate-700 hover:bg-slate-50"
                  title="Dupliser mal"
                  aria-label="Dupliser mal"
                >
                  <Copy className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeTemplate) return;
                    const nextName = window.prompt("Nytt navn på malen", activeTemplate.name)?.trim();
                    if (!nextName) return;
                    const next = templates.map((template) =>
                      template.id === activeTemplate.id ? { ...template, name: nextName } : template,
                    );
                    setTemplates(next);
                    writeTemplateLibrary(next);
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-2 py-2 text-slate-700 hover:bg-slate-50"
                  title="Gi nytt navn"
                  aria-label="Gi nytt navn"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeTemplate) return;
                    if (templates.length <= 1) return;
                    const confirmed = window.confirm(`Slette malen "${activeTemplate.name}"?`);
                    if (!confirmed) return;
                    const next = templates.filter((template) => template.id !== activeTemplate.id);
                    setTemplates(next);
                    writeTemplateLibrary(next);
                    setActiveTemplateId(next[0]?.id ?? DEFAULT_TEMPLATE_ID);
                  }}
                  disabled={templates.length <= 1}
                  className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-2 py-2 text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                  title={templates.length <= 1 ? "Minst én mal må finnes" : "Slett mal"}
                  aria-label="Slett mal"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                <p className="text-xs font-semibold text-slate-700">Bruk mal på valgt klient</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {selectedMember
                    ? `${selectedMember.name.trim() || selectedMember.email.trim() || "Kunde"}`
                    : "Velg en klient i «Lag ny plan»-fanen først."}
                </p>
                <button
                  type="button"
                  disabled={!selectedMember}
                  onClick={() => {
                    if (!activeTemplate || !selectedMember) return;
                    const templatePlan = loadMealPlanForMember(activeTemplate.id);
                    if (!templatePlan) {
                      setTemplateAssignStatus("Fant ingen lagret plan i valgt mal ennå.");
                      return;
                    }
                    const nextPlan = cloneTemplateToMember(templatePlan, selectedMember.id);
                    persistMealPlanLocalAndScheduleCloud(trainerOwnerUserId, nextPlan);
                    setTemplateAssignStatus(`Malen «${activeTemplate.name}» er kopiert til ${selectedMember.name.trim() || "kunden"}.`);
                  }}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Bruk på valgt klient
                </button>
                {templateAssignStatus ? <p className="mt-2 text-xs text-teal-700">{templateAssignStatus}</p> : null}
              </div>
            </aside>
            <div className="min-w-0">
              <TrainerMealPlanEditor
                key={activeTemplate.id}
                memberId={activeTemplate.id}
                memberName={`${activeTemplate.name} (malbibliotek)`}
                memberGoal="Bygg en gjenbrukbar mal som kan brukes som utgangspunkt for klientplaner."
              />
            </div>
          </section>
        )
      ) : !members.length ? (
        <EmptyState
          icon="🍽️"
          title="Ingen klienter med ernæringstilgang"
          description="Aktiver ernæring under Klienter → Profil for kundene du vil lage matplan til."
          className="mt-4"
        />
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            <label className="motus-foodbank-search">
              <Search className="h-4 w-4 text-slate-400" aria-hidden />
              <input
                value={memberSearch}
                onChange={(event) => onMemberSearchChange(event.target.value)}
                placeholder="Søk klient…"
                aria-label="Søk klient"
              />
            </label>
            <ul className="max-h-[min(70vh,28rem)] space-y-1 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm">
              {filteredMembers.map((member) => {
                const active = selectedMember?.id === member.id;
                return (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => onSelectMember(member.id)}
                      className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        active ? "bg-teal-50 text-teal-950 ring-1 ring-teal-200" : "text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{member.name.trim() || "Kunde"}</span>
                        <span className="block truncate text-xs text-slate-500">{member.email}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {filteredMembers.length === 0 ? (
              <p className="text-sm text-slate-500">Ingen klienter matcher søket.</p>
            ) : null}
          </aside>

          <section className="min-w-0">
            {selectedMember ? (
              <TrainerMealPlanEditor
                key={selectedMember.id}
                memberId={selectedMember.id}
                memberName={selectedMember.name.trim() || selectedMember.email.trim() || "Kunde"}
                memberGoal={selectedMember.goal}
                memberPersonalGoals={selectedMember.personalGoals ?? ""}
                trainerOwnerUserId={trainerOwnerUserId}
              />
            ) : (
              <EmptyState
                icon="👤"
                title="Velg en klient"
                description="Velg en klient i listen for å redigere matplanen."
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

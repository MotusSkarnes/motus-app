import { useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { loadMealPlanForMember, readMealPlanHistoryForMember, type MealPlanHistoryEntry } from "../app/mealPlanStorage";
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
export type TemplateApplyMode = "replace" | "merge";
export type TemplateApplyPreview = {
  daysTouched: number;
  mealsWithTemplateItems: number;
  overwriteMeals: number;
  addMeals: number;
};

const MEAL_PLAN_TEMPLATE_LIST_KEY = "motus_meal_plan_templates_v1";
const DEFAULT_TEMPLATE_ID = "__mealplan_template_library__";

function formatHistoryTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

export function cloneTemplateToMember(templatePlan: MealPlan, memberId: string): MealPlan {
  return {
    ...templatePlan,
    id: `mealplan-${memberId}`,
    memberId,
    createdAt: templatePlan.createdAt || new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
  };
}

export function buildTemplateApplyPreview(templatePlan: MealPlan, targetPlan: MealPlan | null): TemplateApplyPreview {
  let mealsWithTemplateItems = 0;
  let overwriteMeals = 0;
  let addMeals = 0;
  for (let dayIndex = 0; dayIndex < templatePlan.days.length; dayIndex += 1) {
    const templateDay = templatePlan.days[dayIndex];
    const targetDay = targetPlan?.days[dayIndex];
    for (let mealIndex = 0; mealIndex < templateDay.meals.length; mealIndex += 1) {
      const templateMeal = templateDay.meals[mealIndex];
      if (!templateMeal.items.length) continue;
      mealsWithTemplateItems += 1;
      const targetMeal = targetDay?.meals[mealIndex];
      if (!targetMeal || !targetMeal.items.length) addMeals += 1;
      else overwriteMeals += 1;
    }
  }
  return {
    daysTouched: templatePlan.days.length,
    mealsWithTemplateItems,
    overwriteMeals,
    addMeals,
  };
}

export function applyTemplateWithMode(
  templatePlan: MealPlan,
  targetMemberId: string,
  targetExistingPlan: MealPlan | null,
  mode: TemplateApplyMode,
): MealPlan {
  if (mode === "replace" || !targetExistingPlan) {
    return cloneTemplateToMember(templatePlan, targetMemberId);
  }
  const mergedDays = templatePlan.days.map((templateDay, dayIndex) => {
    const existingDay = targetExistingPlan.days[dayIndex];
    if (!existingDay) return templateDay;
    return {
      ...existingDay,
      label: templateDay.label,
      meals: templateDay.meals.map((templateMeal, mealIndex) => {
        const existingMeal = existingDay.meals[mealIndex];
        if (!existingMeal) return templateMeal;
        if (!templateMeal.items.length) return existingMeal;
        if (existingMeal.items.length) return existingMeal;
        return {
          ...existingMeal,
          ...templateMeal,
          id: existingMeal.id,
        };
      }),
    };
  });
  return {
    ...targetExistingPlan,
    memberId: targetMemberId,
    id: `mealplan-${targetMemberId}`,
    title: targetExistingPlan.title || templatePlan.title,
    notes: targetExistingPlan.notes || templatePlan.notes,
    targets: targetExistingPlan.targets ?? templatePlan.targets,
    days: mergedDays,
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
  const [templateTargetMemberId, setTemplateTargetMemberId] = useState("");
  const [templateApplyMode, setTemplateApplyMode] = useState<TemplateApplyMode>("replace");
  const [historyStatus, setHistoryStatus] = useState<string | null>(null);

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

  const assignableMembers = useMemo(
    () =>
      [...members]
        .sort((a, b) => a.name.localeCompare(b.name, "nb"))
        .map((member) => pickCanonicalMemberRowForProfile(member, members))
        .filter((member, index, arr) => arr.findIndex((row) => row.id === member.id) === index),
    [members],
  );

  const templateTargetMember = useMemo(
    () => assignableMembers.find((member) => member.id === templateTargetMemberId) ?? null,
    [assignableMembers, templateTargetMemberId],
  );
  const templatePlan = useMemo(
    () => (activeTemplate ? loadMealPlanForMember(activeTemplate.id) : null),
    [activeTemplate],
  );
  const targetExistingPlan = useMemo(
    () => (templateTargetMember ? loadMealPlanForMember(templateTargetMember.id) : null),
    [templateTargetMember],
  );
  const templatePreview = useMemo(
    () => (templatePlan ? buildTemplateApplyPreview(templatePlan, targetExistingPlan) : null),
    [templatePlan, targetExistingPlan],
  );
  const selectedMemberHistory: MealPlanHistoryEntry[] = selectedMember ? readMealPlanHistoryForMember(selectedMember.id) : [];

  useEffect(() => {
    if (!filteredMembers.length) return;
    const stillVisible = filteredMembers.some((member) => member.id === selectedMemberId);
    if (!stillVisible) onSelectMember(filteredMembers[0].id);
  }, [filteredMembers, onSelectMember, selectedMemberId]);

  useEffect(() => {
    if (!assignableMembers.length) {
      setTemplateTargetMemberId("");
      return;
    }
    setTemplateTargetMemberId((prev) => {
      if (prev && assignableMembers.some((member) => member.id === prev)) return prev;
      if (selectedMember && assignableMembers.some((member) => member.id === selectedMember.id)) return selectedMember.id;
      return assignableMembers[0].id;
    });
  }, [assignableMembers, selectedMember]);

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
        <PillButton active={hubTab === "history"} onClick={() => setHubTab("history")}>
          Tidligere planer
        </PillButton>
      </div>

      {hubTab === "history" ? (
        !members.length ? (
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
            </aside>
            <section className="min-w-0 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                Tidligere planer {selectedMember ? `· ${selectedMember.name.trim() || "Kunde"}` : ""}
              </h3>
              {historyStatus ? <p className="mt-2 text-xs text-teal-700">{historyStatus}</p> : null}
              {!selectedMember ? (
                <p className="mt-3 text-sm text-slate-500">Velg en klient for å se historikk.</p>
              ) : selectedMemberHistory.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Ingen snapshots ennå. Historikk lagres automatisk når planer oppdateres.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {selectedMemberHistory.map((entry) => {
                    const mealCount = entry.plan.days.reduce((sum, day) => sum + day.meals.length, 0);
                    const itemCount = entry.plan.days.reduce(
                      (sum, day) => sum + day.meals.reduce((mealSum, meal) => mealSum + meal.items.length, 0),
                      0,
                    );
                    return (
                      <li key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{formatHistoryTimestamp(entry.savedAt)}</p>
                            <p className="text-[11px] text-slate-500">
                              {entry.plan.days.length} dager · {mealCount} måltider · {itemCount} matvalg
                            </p>
                          </div>
                          <button
                            type="button"
                            className="rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-900 hover:bg-teal-100"
                            onClick={() => {
                              if (!selectedMember) return;
                              const restored: MealPlan = {
                                ...entry.plan,
                                id: `mealplan-${selectedMember.id}`,
                                memberId: selectedMember.id,
                                updatedAt: new Date().toISOString(),
                              };
                              persistMealPlanLocalAndScheduleCloud(trainerOwnerUserId, restored);
                              setHistoryStatus(`Plan fra ${formatHistoryTimestamp(entry.savedAt)} er gjenopprettet.`);
                            }}
                          >
                            Gjenopprett
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )
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
                {assignableMembers.length ? (
                  <label className="mt-1 block">
                    <span className="sr-only">Velg klient</span>
                    <select
                      value={templateTargetMemberId}
                      onChange={(event) => setTemplateTargetMemberId(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                    >
                      {assignableMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name.trim() || member.email.trim() || "Kunde"}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-500">Ingen klienter tilgjengelig.</p>
                )}
                <button
                  type="button"
                  disabled={!templateTargetMember}
                  onClick={() => {
                    if (!activeTemplate || !templateTargetMember) return;
                    if (!templatePlan) {
                      setTemplateAssignStatus("Fant ingen lagret plan i valgt mal ennå.");
                      return;
                    }
                    const nextPlan = applyTemplateWithMode(templatePlan, templateTargetMember.id, targetExistingPlan, templateApplyMode);
                    persistMealPlanLocalAndScheduleCloud(trainerOwnerUserId, nextPlan);
                    setTemplateAssignStatus(
                      templateApplyMode === "replace"
                        ? `Malen «${activeTemplate.name}» erstattet planen for ${templateTargetMember.name.trim() || "kunden"}.`
                        : `Malen «${activeTemplate.name}» er flettet inn for ${templateTargetMember.name.trim() || "kunden"}.`,
                    );
                  }}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Bruk på valgt klient
                </button>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setTemplateApplyMode("replace")}
                    className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
                      templateApplyMode === "replace"
                        ? "border-teal-300 bg-teal-50 text-teal-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Erstatt plan
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateApplyMode("merge")}
                    className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
                      templateApplyMode === "merge"
                        ? "border-teal-300 bg-teal-50 text-teal-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Flett inn tomme
                  </button>
                </div>
                {templatePreview ? (
                  <p className="mt-2 text-[11px] text-slate-600">
                    Forhåndsvisning: {templatePreview.daysTouched} dager, {templatePreview.mealsWithTemplateItems} måltider med innhold,{" "}
                    {templateApplyMode === "replace"
                      ? `${templatePreview.overwriteMeals + templatePreview.addMeals} vil settes fra mal`
                      : `${templatePreview.addMeals} tomme måltider fylles (${templatePreview.overwriteMeals} beholdes uendret)`}
                    .
                  </p>
                ) : null}
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

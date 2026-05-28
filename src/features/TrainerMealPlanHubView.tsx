import { useEffect, useMemo, useState } from "react";
import { Search, UserRound } from "lucide-react";
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

export function TrainerMealPlanHubView({
  members,
  selectedMemberId,
  onSelectMember,
  trainerOwnerUserId,
  memberSearch,
  onMemberSearchChange,
}: TrainerMealPlanHubViewProps) {
  const [hubTab, setHubTab] = useState<PlannerHubTab>("new");

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
        <PillButton active={hubTab === "templates"} onClick={() => setHubTab("templates")} disabled>
          Malbibliotek
        </PillButton>
        <PillButton active={hubTab === "history"} onClick={() => setHubTab("history")} disabled>
          Tidligere planer
        </PillButton>
      </div>

      {hubTab !== "new" ? (
        <EmptyState
          icon="🍽️"
          title="Kommer snart"
          description="Malbibliotek og historikk er under utvikling."
          className="mt-4"
        />
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

import { useMemo } from "react";
import { LogOut, UserCircle2 } from "lucide-react";
import { MOTUS } from "../app/data";
import type { AuthUser, Role } from "../app/types";
import { Card, OutlineButton, PillButton } from "../app/ui";
import motusLogo from "../assets/motus-logo-transparent.svg";

export function AppHeader({
  currentUser,
  memberDisplayName,
  memberTrainerDisplayName,
  role,
  showQuickLogin,
  onSwitchRole,
  onResetData,
  onLogout,
  onOpenMemberProfile,
}: {
  currentUser: AuthUser;
  memberDisplayName?: string;
  memberTrainerDisplayName?: string;
  role: Role;
  showQuickLogin: boolean;
  onSwitchRole: (role: Role) => void;
  onResetData: () => void;
  onLogout: () => void;
  onOpenMemberProfile?: () => void;
}) {
  const showProductionSafeQuickTools = showQuickLogin && (import.meta.env.DEV || import.meta.env.MODE === "test");
  const memberFirstName = useMemo(() => {
    const rawName = (memberDisplayName || currentUser.name || "").trim();
    if (!rawName) return "du";
    return rawName.split(/\s+/)[0] || "du";
  }, [currentUser.name, memberDisplayName]);

  const memberMotivationText = useMemo(() => {
    const options = [
      "Klar for neste økt?",
      "Små steg i dag gir stor fremgang i morgen.",
      "Du er nærmere målet enn i går.",
      "En økt nå er en seier senere i uka.",
      "Bygg vanen - kroppen vil takke deg.",
    ];
    const daySeed = new Date().getDate();
    const nameSeed = memberFirstName.length;
    return options[(daySeed + nameSeed) % options.length];
  }, [memberFirstName]);

  const isTrainerPortalView = role === "trainer";
  const trainerDisplayName = useMemo(() => {
    const name = currentUser.name.trim();
    const email = currentUser.email.trim().toLowerCase();
    if (name && name !== "Bruker" && !name.includes("@")) return name;
    const localPart = (email.split("@")[0] ?? "").replace(/[._-]+/g, " ").trim();
    if (!localPart) return "Trener";
    return localPart
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }, [currentUser.email, currentUser.name]);

  return (
    <Card className="overflow-hidden p-4 sm:p-5 md:p-6 bg-[linear-gradient(135deg,rgba(20,184,166,0.07)_0%,rgba(236,72,153,0.07)_100%)]">
      <div
        className="h-1.5 -mx-4 sm:-mx-5 md:-mx-6 -mt-4 sm:-mt-5 md:-mt-6 mb-5"
        style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 70%, ${MOTUS.acid} 100%)` }}
      />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <img src={motusLogo} alt="Motus logo" className="h-10 w-auto object-contain sm:h-11" />
            {currentUser.role === "member" ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenMemberProfile?.()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full md:h-9 md:w-9"
                  style={{ backgroundColor: MOTUS.turquoise, color: "#ffffff" }}
                  aria-label="Åpne profil"
                  title="Profil"
                >
                  <UserCircle2 className="h-4 w-4 md:h-5 md:w-5" />
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full md:h-9 md:w-9"
                  style={{ backgroundColor: MOTUS.pink, color: "#ffffff" }}
                  aria-label="Logg ut"
                  title="Logg ut"
                >
                  <LogOut className="h-4 w-4 md:h-5 md:w-5" />
                </button>
              </div>
            ) : null}
          </div>
          <div>
            {currentUser.role === "member" ? (
              <>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Hei {memberFirstName}</h1>
                <p className="mt-2 text-sm md:text-base text-slate-500 max-w-3xl">{memberMotivationText}</p>
                {memberTrainerDisplayName ? (
                  <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
                    Din PT er <span className="font-semibold text-slate-800">{memberTrainerDisplayName}</span>
                  </p>
                ) : null}
              </>
            ) : isTrainerPortalView ? (
              <>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Motus Coach</h1>
                <div
                  className="mt-3 inline-flex min-w-0 max-w-full items-center gap-3 rounded-2xl border border-emerald-200/90 bg-white/95 px-4 py-3 shadow-sm ring-1 ring-black/5"
                  style={{ borderLeftWidth: 4, borderLeftColor: MOTUS.turquoise }}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                    style={{ background: MOTUS.gradient }}
                    aria-hidden
                  >
                    <UserCircle2 className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Innlogget som PT
                    </span>
                    <span className="block truncate text-base font-bold text-slate-900 sm:text-lg">{trainerDisplayName}</span>
                    <span className="block truncate text-xs text-slate-500 sm:text-sm">{currentUser.email}</span>
                  </span>
                </div>
                <p className="mt-3 text-sm md:text-base text-slate-500 max-w-3xl">
                  Du ser dine kunder, programmer og oppfølging. Medlemmer og andre PT-er ser kun sin egen konto.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Motus Coach</h1>
                <p className="mt-2 text-sm md:text-base text-slate-500 max-w-3xl">
                  Administrer medlemmer, programmer og oppfølging på ett sted.
                </p>
              </>
            )}
          </div>
        </div>
        {showProductionSafeQuickTools ? (
          <Card className="p-1 w-full md:w-auto self-stretch md:self-auto">
            <div className="grid w-full grid-cols-2 md:w-[280px] gap-1 rounded-xl bg-slate-50 p-1">
              <PillButton active={role === "trainer"} onClick={() => onSwitchRole("trainer")}>
                PT-side
              </PillButton>
              <PillButton active={role === "member"} onClick={() => onSwitchRole("member")}>
                Medlemsside
              </PillButton>
            </div>
          </Card>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          {showProductionSafeQuickTools ? <OutlineButton onClick={onResetData}>Nullstill testdata</OutlineButton> : null}
          {currentUser.role !== "member" ? <OutlineButton onClick={onLogout}>Logg ut</OutlineButton> : null}
        </div>
      </div>
    </Card>
  );
}

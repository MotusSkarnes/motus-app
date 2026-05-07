import { useMemo } from "react";
import { LogOut, UserCircle2 } from "lucide-react";
import { MOTUS } from "../app/data";
import type { AuthUser, Role } from "../app/types";
import { Card, OutlineButton, PillButton } from "../app/ui";
import motusLogo from "../assets/motus-logo.png";

export function AppHeader({
  currentUser,
  role,
  showQuickLogin,
  onSwitchRole,
  onResetData,
  onLogout,
  onOpenMemberProfile,
}: {
  currentUser: AuthUser;
  role: Role;
  showQuickLogin: boolean;
  onSwitchRole: (role: Role) => void;
  onResetData: () => void;
  onLogout: () => void;
  onOpenMemberProfile?: () => void;
}) {
  const showProductionSafeQuickTools = showQuickLogin && !import.meta.env.PROD;
  const memberFirstName = useMemo(() => {
    const rawName = currentUser.name?.trim() ?? "";
    if (!rawName) return "du";
    return rawName.split(/\s+/)[0] || "du";
  }, [currentUser.name]);

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

  return (
    <Card className="overflow-hidden p-4 sm:p-5 md:p-6 bg-[linear-gradient(135deg,rgba(20,184,166,0.07)_0%,rgba(236,72,153,0.07)_100%)]">
      <div
        className="h-1.5 -mx-4 sm:-mx-5 md:-mx-6 -mt-4 sm:-mt-5 md:-mt-6 mb-5"
        style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 70%, ${MOTUS.acid} 100%)` }}
      />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <img src={motusLogo} alt="Motus logo" className="h-14 w-auto object-contain" />
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
              </>
            ) : (
              <>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Motus Coach</h1>
                <p className="mt-2 text-sm md:text-base text-slate-500 max-w-3xl">
                  Administrer medlemmer, programmer og oppfolging pa ett sted.
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

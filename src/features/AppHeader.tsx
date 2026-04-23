import { useMemo } from "react";
import { MOTUS } from "../app/data";
import type { AuthUser, Role } from "../app/types";
import { Badge, Card, OutlineButton, PillButton } from "../app/ui";
import motusLogo from "../assets/motus-logo.png";

export function AppHeader({
  currentUser,
  role,
  showQuickLogin,
  onSwitchRole,
  onResetData,
  onLogout,
}: {
  currentUser: AuthUser;
  role: Role;
  showQuickLogin: boolean;
  onSwitchRole: (role: Role) => void;
  onResetData: () => void;
  onLogout: () => void;
}) {
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
    <Card className="overflow-hidden p-4 sm:p-5 md:p-6">
      <div
        className="h-1.5 -mx-4 sm:-mx-5 md:-mx-6 -mt-4 sm:-mt-5 md:-mt-6 mb-5"
        style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 70%, ${MOTUS.acid} 100%)` }}
      />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <img src={motusLogo} alt="Motus logo" className="h-14 w-auto object-contain" />
            <Badge>{currentUser.role === "trainer" ? "PT" : "Medlem"}</Badge>
            <Badge>{currentUser.name}</Badge>
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
        {showQuickLogin ? (
          <Card className="p-1 w-full md:w-auto self-stretch md:self-auto">
            <div className="grid w-full grid-cols-2 md:w-[280px] gap-1 rounded-2xl bg-slate-50 p-1">
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
          {showQuickLogin ? <OutlineButton onClick={onResetData}>Nullstill testdata</OutlineButton> : null}
          <OutlineButton onClick={onLogout}>Logg ut</OutlineButton>
        </div>
      </div>
    </Card>
  );
}

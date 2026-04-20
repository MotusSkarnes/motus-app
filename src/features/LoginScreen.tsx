import { MOTUS } from "../app/data";
import { Badge, Card, GradientButton, StatCard, TextInput } from "../app/ui";

type LoginScreenProps = {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  onLogin: () => void | Promise<void>;
  loginError: string | null;
  quickLogin: (email: string) => void;
  showQuickLogin: boolean;
};

export function LoginScreen(props: LoginScreenProps) {
  const { email, setEmail, password, setPassword, onLogin, loginError, quickLogin, showQuickLogin } = props;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="overflow-hidden p-6 sm:p-8">
        <div className="h-1.5 -mx-6 sm:-mx-8 -mt-6 sm:-mt-8 mb-6" style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 70%, ${MOTUS.acid} 100%)` }} />
        <div className="max-w-2xl space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl px-4 py-2 shadow-sm text-white font-black tracking-tight" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>MOTUS</div>
            <Badge>PT App</Badge>
            <Badge>Stabil base</Badge>
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Logg inn i Motus PT-app</h1>
            <p className="mt-2 text-slate-500">En ny, ren og stabil startfil med trygg lokal lagring.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Brukere" value="3" hint="Demo-kontoer klare" />
            <StatCard label="Lagring" value="Stabil" hint="LocalStorage" />
            <StatCard label="Mål" value="Ren base" hint="Bygg videre herfra" />
          </div>
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Innlogging</h2>
            <p className="text-sm text-slate-500">{showQuickLogin ? "Bruk demo-bruker for testing" : "Logg inn med Supabase-konto"}</p>
          </div>
          <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-post" />
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passord" />
          {loginError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loginError}</div> : null}
          <GradientButton onClick={onLogin} className="w-full">Logg inn</GradientButton>

          {showQuickLogin ? (
            <>
              <div className="pt-4 space-y-2">
                <button type="button" onClick={() => quickLogin("trainer@motus.no")} className="w-full rounded-2xl border bg-slate-50 px-4 py-3 text-left text-sm">
                  <div className="font-medium">Logg inn som trener</div>
                  <div className="text-slate-500">trainer@motus.no</div>
                </button>
                <button type="button" onClick={() => quickLogin("emma@example.com")} className="w-full rounded-2xl border bg-slate-50 px-4 py-3 text-left text-sm">
                  <div className="font-medium">Logg inn som Emma</div>
                  <div className="text-slate-500">Medlem</div>
                </button>
                <button type="button" onClick={() => quickLogin("martin@example.com")} className="w-full rounded-2xl border bg-slate-50 px-4 py-3 text-left text-sm">
                  <div className="font-medium">Logg inn som Martin</div>
                  <div className="text-slate-500">Medlem</div>
                </button>
              </div>
              <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-600">Testpassord på alle brukere: <span className="font-semibold">123456</span></div>
            </>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

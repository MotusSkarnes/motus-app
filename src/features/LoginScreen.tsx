import { MOTUS } from "../app/data";
import { Badge, Card, GradientButton, StatCard, TextInput } from "../app/ui";
import motusLogo from "../assets/motus-logo.png";

type LoginScreenProps = {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  onLogin: () => void | Promise<void>;
  loginError: string | null;
  isRecoveryMode: boolean;
  recoveryPassword: string;
  setRecoveryPassword: (value: string) => void;
  recoveryPasswordConfirm: string;
  setRecoveryPasswordConfirm: (value: string) => void;
  recoveryError: string | null;
  recoveryInfo: string | null;
  onCompleteRecovery: () => void | Promise<void>;
  passwordRecoveryInfo: string | null;
  passwordRecoveryError: string | null;
  passwordRecoveryCooldownSeconds: number;
  onSendPasswordRecovery: () => void | Promise<void>;
  quickLogin: (email: string) => void;
  showQuickLogin: boolean;
};

export function LoginScreen(props: LoginScreenProps) {
  const {
    email,
    setEmail,
    password,
    setPassword,
    onLogin,
    loginError,
    isRecoveryMode,
    recoveryPassword,
    setRecoveryPassword,
    recoveryPasswordConfirm,
    setRecoveryPasswordConfirm,
    recoveryError,
    recoveryInfo,
    onCompleteRecovery,
    passwordRecoveryInfo,
    passwordRecoveryError,
    passwordRecoveryCooldownSeconds,
    onSendPasswordRecovery,
    quickLogin,
  } = props;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="overflow-hidden p-6 sm:p-8">
        <div className="h-1.5 -mx-6 sm:-mx-8 -mt-6 sm:-mt-8 mb-6" style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 70%, ${MOTUS.acid} 100%)` }} />
        <div className="max-w-2xl space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <img src={motusLogo} alt="Motus logo" className="h-14 w-auto" />
            <Badge>PT App</Badge>
            <Badge>Klar til bruk</Badge>
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Logg inn i Motus PT-app</h1>
            <p className="mt-2 text-slate-500">Logg inn for a administrere medlemmer, programmer og oppfolging.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Brukere" value="3" hint="Demo-kontoer klare" />
            <StatCard label="Lagring" value="Lokal" hint="Lagres i nettleseren" />
            <StatCard label="Flyt" value="Enkel" hint="Rask demo-innlogging" />
          </div>
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{isRecoveryMode ? "Sett nytt passord" : "Innlogging"}</h2>
            <p className="text-sm text-slate-500">
              {isRecoveryMode ? "Recovery-lenken er aktiv. Velg et nytt passord." : "Skriv inn e-post/passord for vanlig Supabase-innlogging."}
            </p>
          </div>
          {isRecoveryMode ? (
            <>
              {recoveryInfo ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{recoveryInfo}</div> : null}
              <TextInput type="password" value={recoveryPassword} onChange={(e) => setRecoveryPassword(e.target.value)} placeholder="Nytt passord (minst 6 tegn)" />
              <TextInput type="password" value={recoveryPasswordConfirm} onChange={(e) => setRecoveryPasswordConfirm(e.target.value)} placeholder="Gjenta nytt passord" />
              {recoveryError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{recoveryError}</div> : null}
              <GradientButton onClick={onCompleteRecovery} className="w-full">Lagre nytt passord</GradientButton>
            </>
          ) : (
            <>
              <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-post" />
              <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passord" />
              {loginError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loginError}</div> : null}
              <GradientButton onClick={onLogin} className="w-full">Logg inn</GradientButton>
              <button
                type="button"
                onClick={onSendPasswordRecovery}
                disabled={passwordRecoveryCooldownSeconds > 0}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {passwordRecoveryCooldownSeconds > 0 ? `Send ny reset-lenke om ${passwordRecoveryCooldownSeconds}s` : "Glemt passord?"}
              </button>
              {passwordRecoveryInfo ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{passwordRecoveryInfo}</div> : null}
              {passwordRecoveryError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{passwordRecoveryError}</div> : null}

              <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-xs text-slate-600">
                Demo-knappene under logger deg rett inn lokalt for testing, uavhengig av Supabase.
              </div>
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
          )}
        </div>
      </Card>
    </div>
  );
}

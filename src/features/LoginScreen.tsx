import { MOTUS } from "../app/data";
import { Badge, Card, GradientButton, StatCard, StatusMessage, TextInput } from "../app/ui";
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
  otpCode: string;
  setOtpCode: (value: string) => void;
  otpInfo: string | null;
  otpError: string | null;
  onSendEmailOtpCode: () => void | Promise<void>;
  onLoginWithEmailOtpCode: () => void | Promise<void>;
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
    otpCode,
    setOtpCode,
    otpInfo,
    otpError,
    onSendEmailOtpCode,
    onLoginWithEmailOtpCode,
    quickLogin,
    showQuickLogin,
  } = props;
  const showProductionSafeQuickLogin = showQuickLogin && (import.meta.env.DEV || import.meta.env.MODE === "test");

  return (
    <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{ background: `radial-gradient(circle at 15% 20%, ${MOTUS.turquoise} 0%, transparent 38%), radial-gradient(circle at 85% 15%, ${MOTUS.pink} 0%, transparent 40%), radial-gradient(circle at 80% 90%, ${MOTUS.acid} 0%, transparent 34%)` }}
        />
        <div className="h-1.5 -mx-6 sm:-mx-8 -mt-6 sm:-mt-8 mb-6" style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 70%, ${MOTUS.acid} 100%)` }} />
        <div className="relative max-w-2xl space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <img src={motusLogo} alt="Motus logo" className="h-16 w-auto object-contain" />
            <Badge>Motus Coach</Badge>
            <Badge>Profesjonell PT-flyt</Badge>
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Velkommen til Motus Coach</h1>
            <p className="mt-2 max-w-xl text-slate-600">Logg inn for å styre kunder, programmer, periodeplaner, fremgang og oppfølging i en samlet arbeidsflate.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Kunder" value="Full kontroll" hint="Profiler, meldinger, planer" />
            <StatCard label="Trening" value="Smart flyt" hint="Program + intervalltimer" />
            <StatCard label="Oppfølging" value="Daglig" hint="Mål og progresjon" />
          </div>
          <div className="rounded-xl border bg-white/80 p-4 backdrop-blur-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-sm font-semibold text-slate-800">Hva er nytt i appen</div>
            <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <div>• Periodeplan med uke-for-uke styring</div>
              <div>• Tildelbare intervallprogrammer</div>
              <div>• Streaks og achievements nivå 1-10</div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{isRecoveryMode ? "Sett nytt passord" : "Innlogging"}</h2>
            <p className="text-sm text-slate-500">
              {isRecoveryMode ? "Recovery-lenken er aktiv. Velg et nytt passord." : "Logg inn med e-post og passord."}
            </p>
          </div>
          {isRecoveryMode ? (
            <>
              {recoveryInfo ? <StatusMessage message={recoveryInfo} tone="success" /> : null}
              <TextInput type="password" value={recoveryPassword} onChange={(e) => setRecoveryPassword(e.target.value)} placeholder="Nytt passord (minst 6 tegn)" />
              <TextInput type="password" value={recoveryPasswordConfirm} onChange={(e) => setRecoveryPasswordConfirm(e.target.value)} placeholder="Gjenta nytt passord" />
              {recoveryError ? <StatusMessage message={recoveryError} tone="error" /> : null}
              <GradientButton onClick={onCompleteRecovery} className="w-full">Lagre nytt passord</GradientButton>
            </>
          ) : (
            <>
              <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-post" />
              <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passord" />
              {loginError ? <StatusMessage message={loginError} tone="error" /> : null}
              <GradientButton onClick={onLogin} className="w-full">Logg inn</GradientButton>
              <button
                type="button"
                onClick={onSendPasswordRecovery}
                disabled={passwordRecoveryCooldownSeconds > 0}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {passwordRecoveryCooldownSeconds > 0 ? `Send ny reset-lenke om ${passwordRecoveryCooldownSeconds}s` : "Glemt passord?"}
              </button>
              {passwordRecoveryInfo ? <StatusMessage message={passwordRecoveryInfo} tone="success" /> : null}
              {passwordRecoveryError ? <StatusMessage message={passwordRecoveryError} tone="error" /> : null}
              <div className="rounded-xl border bg-slate-50 px-4 py-3">
                <div className="text-sm font-semibold text-slate-700">Logg inn med engangskode</div>
                <div className="mt-1 text-xs text-slate-500">Få en kode på e-post og logg inn raskt.</div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={onSendEmailOtpCode}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
                  >
                    Send engangskode
                  </button>
                  <TextInput
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Skriv engangskode"
                  />
                  <GradientButton onClick={onLoginWithEmailOtpCode} className="w-full sm:w-auto">
                    Logg inn med kode
                  </GradientButton>
                </div>
                {otpInfo ? <StatusMessage message={otpInfo} tone="success" className="mt-2 !rounded-xl !px-3 !py-2 !text-xs" /> : null}
                {otpError ? <StatusMessage message={otpError} tone="error" className="mt-2 !rounded-xl !px-3 !py-2 !text-xs" /> : null}
              </div>

              {showProductionSafeQuickLogin ? (
                <>
                  <div className="rounded-xl border bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    Hurtigvalg for lokal innlogging.
                  </div>
                  <div className="pt-4 space-y-2">
                    <button type="button" onClick={() => quickLogin("trainer@motus.no")} className="w-full rounded-xl border bg-slate-50 px-4 py-3 text-left text-sm">
                      <div className="font-medium">Logg inn som trener</div>
                      <div className="text-slate-500">trainer@motus.no</div>
                    </button>
                    <button type="button" onClick={() => quickLogin("emma@example.com")} className="w-full rounded-xl border bg-slate-50 px-4 py-3 text-left text-sm">
                      <div className="font-medium">Logg inn som Emma</div>
                      <div className="text-slate-500">Medlem</div>
                    </button>
                    <button type="button" onClick={() => quickLogin("martin@example.com")} className="w-full rounded-xl border bg-slate-50 px-4 py-3 text-left text-sm">
                      <div className="font-medium">Logg inn som Martin</div>
                      <div className="text-slate-500">Medlem</div>
                    </button>
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

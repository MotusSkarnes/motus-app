import { useEffect, useRef, useState } from "react";
import { OfflineBanner } from "./app/OfflineBanner";
import { AppErrorBoundary } from "./app/AppErrorBoundary";
import { resolveLayoutRole } from "./app/resolveLayoutRole";
import { useAppViewModel } from "./app/viewmodels";
import { AppShell } from "./app/ui";
import { AppHeader, LoginScreen, MemberLayout, TrainerLayout } from "./features";
import { isSupabaseConfigured } from "./services/supabaseClient";

const AUTH_LOADING_RELOAD_MS = 12_000;

function AuthLoadingCard() {
  const [stale, setStale] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    timer.current = setTimeout(() => setStale(true), AUTH_LOADING_RELOAD_MS);
    return () => clearTimeout(timer.current);
  }, []);

  if (stale) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm space-y-3">
        <div className="font-semibold">Innlogging tar for lang tid</div>
        <div className="text-xs leading-relaxed">
          Appen klarte ikke å sjekke sesjonen din. Trykk knappen under for å prøve på nytt.
          Hvis det fortsatt ikke fungerer, tøm nettleser-cache for Motus og logg inn igjen.
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm"
        >
          Last inn siden på nytt
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm space-y-2">
      <div>Sjekker innlogging…</div>
      <div className="text-xs text-slate-500">
        Hvis dette henger, last siden på nytt. Vedvarende problem: logg ut i nettleseren og tøm cache for Motus.
      </div>
    </div>
  );
}

export default function App() {
  const { appState, isAuthSessionLoading, isRecoveryMode, loginScreenProps, appHeaderProps, trainerLayoutProps, memberLayoutProps } =
    useAppViewModel();
  const layoutRole = resolveLayoutRole(appState);

  return (
    <AppErrorBoundary>
      <AppShell>
      {isAuthSessionLoading && !isRecoveryMode ? (
        <AuthLoadingCard />
      ) : !appState.currentUser || isRecoveryMode ? (
        <LoginScreen {...loginScreenProps} />
      ) : (
        <div
          className={`space-y-3 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] xl:space-y-4 xl:pb-6 ${layoutRole === "trainer" ? "motus-trainer-app" : ""}`}
        >
          {!isSupabaseConfigured ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="font-semibold">Supabase er ikke konfigurert.</div>
              <div className="mt-1">
                Appen kjører i lokal/demo-modus og data synkes ikke mellom trenere/medlemmer.
              </div>
            </div>
          ) : null}
          <OfflineBanner />
          <AppHeader {...appHeaderProps} />

          {layoutRole === "trainer" ? <TrainerLayout {...trainerLayoutProps} /> : <MemberLayout {...memberLayoutProps} />}
        </div>
      )}
      </AppShell>
    </AppErrorBoundary>
  );
}

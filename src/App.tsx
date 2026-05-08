import { OfflineBanner } from "./app/OfflineBanner";
import { useAppViewModel } from "./app/viewmodels";
import { AppShell } from "./app/ui";
import { AppHeader, LoginScreen, MemberLayout, TrainerLayout } from "./features";
import { configuredSupabaseProjectRef, configuredSupabaseUrl, isSupabaseConfigured } from "./services/supabaseClient";

export default function App() {
  const { appState, isRecoveryMode, loginScreenProps, appHeaderProps, trainerLayoutProps, memberLayoutProps } =
    useAppViewModel();

  return (
    <AppShell>
      {!appState.currentUser || isRecoveryMode ? (
        <LoginScreen {...loginScreenProps} />
      ) : (
        <div className="space-y-6 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-6">
          {!isSupabaseConfigured ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="font-semibold">Supabase er ikke konfigurert.</div>
              <div className="mt-1">
                Appen kjører i lokal/demo-modus og data synkes ikke mellom trenere/medlemmer.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
              Supabase prosjekt: <span className="font-semibold">{configuredSupabaseProjectRef || "ukjent"}</span>
              {configuredSupabaseUrl ? <span className="ml-2">({configuredSupabaseUrl})</span> : null}
            </div>
          )}
          <OfflineBanner />
          <AppHeader {...appHeaderProps} />

          {appState.role === "trainer" ? <TrainerLayout {...trainerLayoutProps} /> : <MemberLayout {...memberLayoutProps} />}
        </div>
      )}
    </AppShell>
  );
}

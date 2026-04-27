import { OfflineBanner } from "./app/OfflineBanner";
import { useAppViewModel } from "./app/viewmodels";
import { AppShell } from "./app/ui";
import { AppHeader, LoginScreen, MemberLayout, TrainerLayout } from "./features";

export default function App() {
  const { appState, isRecoveryMode, loginScreenProps, appHeaderProps, trainerLayoutProps, memberLayoutProps } =
    useAppViewModel();

  return (
    <AppShell>
      {!appState.currentUser || isRecoveryMode ? (
        <LoginScreen {...loginScreenProps} />
      ) : (
        <div className="space-y-6 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-6">
          <OfflineBanner />
          <AppHeader {...appHeaderProps} />

          {appState.role === "trainer" ? <TrainerLayout {...trainerLayoutProps} /> : <MemberLayout {...memberLayoutProps} />}
        </div>
      )}
    </AppShell>
  );
}

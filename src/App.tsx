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
        <div className="space-y-6 pb-20 sm:pb-6">
          <AppHeader {...appHeaderProps} />

          {appState.role === "trainer" ? <TrainerLayout {...trainerLayoutProps} /> : <MemberLayout {...memberLayoutProps} />}
        </div>
      )}
    </AppShell>
  );
}

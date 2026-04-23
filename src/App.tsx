import { useAppViewModel } from "./app/viewmodels/useAppViewModel";
import { AppShell } from "./app/ui";
import { AppHeader } from "./features/AppHeader";
import { LoginScreen } from "./features/LoginScreen";
import { MemberLayout } from "./features/MemberLayout";
import { TrainerLayout } from "./features/TrainerLayout";

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

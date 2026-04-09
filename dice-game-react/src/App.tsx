import { GameProvider } from './context/GameContext';
import { AuthProvider } from './context/AuthContext';
import { MultiplayerProvider } from './multiplayer/MultiplayerContext';
import ScreenRouter from './components/ScreenRouter';
import { useI18n } from './hooks/useI18n';

export default function App() {
  const { ready } = useI18n();

  if (!ready) return null;

  return (
    <AuthProvider>
      <MultiplayerProvider>
        <GameProvider>
          <div data-size="m">
            <ScreenRouter />
          </div>
        </GameProvider>
      </MultiplayerProvider>
    </AuthProvider>
  );
}

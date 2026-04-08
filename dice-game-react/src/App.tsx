import { GameProvider } from './context/GameContext';
import ScreenRouter from './components/ScreenRouter';
import { useI18n } from './hooks/useI18n';

export default function App() {
  const { ready } = useI18n();

  if (!ready) return null;

  return (
    <GameProvider>
      <div data-size="m">
        <ScreenRouter />
      </div>
    </GameProvider>
  );
}

import { useState, useCallback, useEffect } from 'react';
import { useGameContext } from '../context/GameContext';
import { useHashRouter } from '../hooks/useHashRouter';
import { t } from '../hooks/useI18n';
import Modal from '../components/Modal';
import PlayerSetup from '../components/PlayerSetup';
import type { GameModeConfig } from '@pwa/game/game-mode-registry';

interface HighscoreEntry { name: string; score: number; date: number; }

export default function HomeScreen() {
  const { registry, gameStore, storeReady, startGame } = useGameContext();
  const { navigate } = useHashRouter();
  const [showKniffelModal, setShowKniffelModal] = useState(false);
  const [highscores, setHighscores] = useState<HighscoreEntry[]>([]);

  const modes = registry.getAll();

  useEffect(() => {
    if (!storeReady || !gameStore) return;
    gameStore.listFinished().then((finished) => {
      const scores: HighscoreEntry[] = [];
      for (const game of finished) {
        if (!game.scores || !game.players) continue;
        for (const player of game.players) {
          const sheet = game.scores[player.id];
          if (sheet && typeof sheet.totalScore === 'number')
            scores.push({ name: player.name, score: sheet.totalScore, date: game.updatedAt });
        }
      }
      scores.sort((a, b) => b.score - a.score);
      setHighscores(scores.slice(0, 5));
    }).catch(() => {});
  }, [storeReady, gameStore]);

  const handleModeClick = useCallback((mode: GameModeConfig) => {
    if (mode.id === 'free-roll') {
      startGame('free-roll', [{ id: 'p1', name: 'Spieler 1', isHost: true }], 'solo');
      navigate('game', { modeId: 'free-roll', playType: 'solo' });
    } else if (mode.id === 'kniffel') {
      setShowKniffelModal(true);
    }
  }, [navigate, startGame]);

  return (
    <div className="home-screen">
      <h1 className="adaptive headline" data-level="1">{t('home.title')}</h1>
      <p className="adaptive text">{t('home.subtitle')}</p>

      <div className="mode-grid">
        {modes.map((mode) => (
          <button key={mode.id} type="button" className="adaptive card mode-card"
            data-interactive="" data-material="filled" onClick={() => handleModeClick(mode)}>
            <div className="card__content">
              <span className="adaptive headline" data-level="4">{t(mode.name)}</span>
              <span className="adaptive text text--small">{t(`${mode.name}.description`)}</span>
            </div>
          </button>
        ))}
      </div>

      <Modal open={showKniffelModal} onClose={() => setShowKniffelModal(false)} title={t('mode.kniffel')}>
        <PlayerSetup />
      </Modal>

      {highscores.length > 0 && (
        <section className="highscore-section">
          <h2 className="adaptive headline" data-level="3">Highscores</h2>
          <ol className="highscore-list">
            {highscores.map((entry, i) => (
              <li key={`${entry.name}-${entry.date}-${i}`} className="adaptive highscore-item" data-material="semi-transparent">
                <span>{i + 1}.</span>
                <span className="highscore-item__name">{entry.name}</span>
                <span className="highscore-item__score">{entry.score}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

import { useState, useCallback, useEffect, useRef } from 'react';
import { useGameContext } from '../context/GameContext';
import { useMultiplayer } from '../multiplayer/MultiplayerContext';
import { useHashRouter } from '../hooks/useHashRouter';
import { t } from '../hooks/useI18n';
import Modal from '../components/Modal';
import PlayerSetup from '../components/PlayerSetup';
import type { GameModeConfig } from '@pwa/game/game-mode-registry';

interface HighscoreEntry { name: string; score: number; date: number; }

export default function HomeScreen() {
  const { registry, gameStore, storeReady, startGame } = useGameContext();
  const { hostCreateRoom, clientJoinRoom } = useMultiplayer();
  const { navigate } = useHashRouter();
  const [showKniffelModal, setShowKniffelModal] = useState(false);
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [onlineName, setOnlineName] = useState('Spieler');
  const [joinCode, setJoinCode] = useState('');
  const [highscores, setHighscores] = useState<HighscoreEntry[]>([]);
  const startGameRef = useRef<(() => void) | null>(null);

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

  const handleCreateRoom = useCallback(() => {
    const name = onlineName.trim() || 'Spieler';
    hostCreateRoom(name);
    setShowOnlineModal(false);
    navigate('lobby');
  }, [onlineName, hostCreateRoom, navigate]);

  const handleJoinRoom = useCallback(() => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    const name = onlineName.trim() || 'Spieler';
    clientJoinRoom(code, name);
    setShowOnlineModal(false);
    navigate('lobby');
  }, [joinCode, onlineName, clientJoinRoom, navigate]);

  return (
    <div className="home-screen">
      <h1 className="adaptive headline" data-level="1">{t('home.title')}</h1>
      <p className="adaptive text">{t('home.subtitle')}</p>

      <div className="mode-grid">
        {modes.map((mode) => (
          <button key={mode.id} type="button" className="adaptive card mode-card"
            data-interactive="" data-material="filled-2" onClick={() => handleModeClick(mode)}>
            <div className="card__content">
              <span className="headline" data-level="4">{t(mode.name)}</span>
              <span>{t(`${mode.name}.description`)}</span>
            </div>
          </button>
        ))}
        <button type="button" className="adaptive card mode-card"
          data-interactive="" data-material="filled-2" onClick={() => setShowOnlineModal(true)}>
          <div className="card__content">
            <span className="headline" data-level="4">Online Kniffel</span>
            <span>Spiele Kniffel online mit Freunden.</span>
          </div>
        </button>
      </div>

      <Modal open={showKniffelModal} onClose={() => setShowKniffelModal(false)} title={t('mode.kniffel')}
        footer={
          <button type="button" className="adaptive button button--full-width" data-interactive=""
            data-material="inverted" data-container-contrast="max"
            onClick={() => startGameRef.current?.()}>{t('home.startLocal')}</button>
        }>
        <PlayerSetup onStartReady={(fn) => { startGameRef.current = fn; }} />
      </Modal>

      <Modal open={showOnlineModal} onClose={() => setShowOnlineModal(false)} title="Online Kniffel">
        <div className="player-setup">
          <label className="adaptive input">
            <span>Dein Name</span>
            <input type="text" className="adaptive input__field" data-material="filled-2" data-interactive=""
              value={onlineName} onChange={(e) => setOnlineName(e.target.value)} placeholder="Spieler" />
          </label>

          <button className="adaptive button button--full-width" data-interactive=""
            data-material="inverted" data-container-contrast="max"
            onClick={handleCreateRoom}>Raum erstellen</button>

          <div className="lobby-divider">
            <span className="adaptive divider" />
            <span className="lobby-divider__text">oder</span>
            <span className="adaptive divider" />
          </div>

          <label className="adaptive input">
            <span>Raum-Code</span>
            <input type="text" className="adaptive input__field" data-material="filled-2" data-interactive=""
              value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="z.B. ABC12" maxLength={5} />
          </label>

          <button className="adaptive button button--full-width" data-interactive=""
            data-material="filled" disabled={!joinCode.trim()}
            onClick={handleJoinRoom}>Raum beitreten</button>
        </div>
      </Modal>

      {highscores.length > 0 && (
        <section className="highscore-section">
          <h2 className="adaptive headline" data-level="3">Highscores</h2>
          <ol className="highscore-list">
            {highscores.map((entry, i) => (
              <li key={`${entry.name}-${entry.date}-${i}`} className="adaptive highscore-item" data-material="">
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

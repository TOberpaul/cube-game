import { useState, useCallback, useEffect, useRef } from 'react';
import { useGameContext } from '../context/GameContext';
import { useAuth } from '../context/AuthContext';
import { useMultiplayer } from '../multiplayer/MultiplayerContext';
import { useHashRouter } from '../hooks/useHashRouter';
import { t } from '../hooks/useI18n';
import { LogIn, X } from 'lucide-react';
import Modal from '../components/Modal';
import PlayerSetup from '../components/PlayerSetup';
import { fetchGlobalHighscores, type GlobalHighscore } from '../multiplayer/highscores';
import type { GameModeConfig } from '@pwa/game/game-mode-registry';

interface LocalHighscore { name: string; score: number; date: number; }

export default function HomeScreen() {
  const { registry, gameStore, storeReady, startGame } = useGameContext();
  const { user, displayName, avatarUrl, signInWithGoogle, signOut } = useAuth();
  const { hostCreateRoom, clientJoinRoom } = useMultiplayer();
  const { navigate } = useHashRouter();
  const [showKniffelModal, setShowKniffelModal] = useState(false);
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [onlineName, setOnlineName] = useState(displayName || 'Spieler');
  const [joinCode, setJoinCode] = useState('');
  const [localHighscores, setLocalHighscores] = useState<LocalHighscore[]>([]);
  const [globalHighscores, setGlobalHighscores] = useState<GlobalHighscore[]>([]);
  const [hsTab, setHsTab] = useState<'local' | 'global'>('local');
  const [hsHintDismissed, setHsHintDismissed] = useState(false);
  const startGameRef = useRef<(() => void) | null>(null);

  const modes = registry.getAll();

  // Update online name when user logs in
  useEffect(() => {
    if (displayName) setOnlineName(displayName);
  }, [displayName]);

  // Load local highscores
  useEffect(() => {
    if (!storeReady || !gameStore) return;
    gameStore.listFinished().then((finished) => {
      const scores: LocalHighscore[] = [];
      for (const game of finished) {
        if (!game.scores || !game.players) continue;
        for (const player of game.players) {
          const sheet = game.scores[player.id];
          if (sheet && typeof sheet.totalScore === 'number')
            scores.push({ name: player.name, score: sheet.totalScore, date: game.updatedAt });
        }
      }
      scores.sort((a, b) => b.score - a.score);
      setLocalHighscores(scores.slice(0, 10));
    }).catch(() => {});
  }, [storeReady, gameStore]);

  // Load global highscores
  useEffect(() => {
    fetchGlobalHighscores(10).then(setGlobalHighscores);
  }, []);

  const handleModeClick = useCallback((mode: GameModeConfig) => {
    if (mode.id === 'free-roll') {
      startGame('free-roll', [{ id: 'p1', name: displayName || 'Spieler 1', isHost: true }], 'solo');
      navigate('game', { modeId: 'free-roll', playType: 'solo' });
    } else if (mode.id === 'kniffel') {
      setShowKniffelModal(true);
    }
  }, [navigate, startGame, displayName]);

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

  const highscores = hsTab === 'local' ? localHighscores : globalHighscores;
  const hasAnyHighscores = localHighscores.length > 0 || globalHighscores.length > 0;

  return (
    <div className="home-screen">
      <div className="home-topbar">
        <h1 className="adaptive headline" data-level="1">{t('home.title')}</h1>
        {user ? (
          <button className="home-avatar-btn" aria-label="Abmelden" onClick={signOut}>
            {avatarUrl ? (
              <img className="home-avatar-img" src={avatarUrl} alt={displayName || ''} referrerPolicy="no-referrer" />
            ) : (
              <span className="home-avatar-fallback">{displayName?.charAt(0)?.toUpperCase() || '?'}</span>
            )}
          </button>
        ) : (
          <button className="adaptive button button--icon-only" data-interactive="" data-material="transparent"
            aria-label="Anmelden" onClick={signInWithGoogle}>
            <LogIn className="icon" size={20} />
          </button>
        )}
      </div>
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

      {hasAnyHighscores && (
        <section className="highscore-section">
          <div className="highscore-header">
            <h2 className="adaptive headline" data-level="3">Highscores</h2>
            <div className="highscore-tabs" role="tablist">
              <button role="tab" aria-selected={hsTab === 'local'} className="adaptive button" data-interactive=""
                data-material={hsTab === 'local' ? 'inverted' : 'filled'} data-container-contrast={hsTab === 'local' ? 'max' : undefined} data-size="s"
                onClick={() => setHsTab('local')}>Lokal</button>
              <button role="tab" aria-selected={hsTab === 'global'} className="adaptive button" data-interactive=""
                data-material={hsTab === 'global' ? 'inverted' : 'filled'} data-container-contrast={hsTab === 'global' ? 'max' : undefined} data-size="s"
                onClick={() => setHsTab('global')}>Global</button>
            </div>
          </div>
          {hsTab === 'global' && !user && !hsHintDismissed && (
            <div className="adaptive notification" data-material="filled" data-color="cyan" role="status">
              <div className="notification__content">
                <p className="notification__message">Melde dich an, um deine Scores im globalen Ranking zu speichern.</p>
              </div>
              <button className="adaptive button button--icon-only" data-interactive="" data-material="transparent" data-relation="smaller"
                aria-label="Schließen" onClick={() => setHsHintDismissed(true)}>
                <X className="icon" size={16} />
              </button>
            </div>
          )}
          {highscores.length > 0 ? (
            <ol className="highscore-list">
              {highscores.map((entry, i) => (
                <li key={`${hsTab}-${i}`} className="adaptive highscore-item" data-material="">
                  <span>{i + 1}.</span>
                  <span className="highscore-item__name">
                    {'player_name' in entry ? entry.player_name : entry.name}
                  </span>
                  <span className="highscore-item__score">{entry.score}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="highscore-empty">
              {hsTab === 'global' ? 'Noch keine globalen Highscores.' : 'Noch keine lokalen Highscores.'}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

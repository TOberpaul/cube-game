import { useState, useCallback, useEffect } from 'react';
import { useHashRouter } from '../hooks/useHashRouter';
import { useMultiplayer } from '../multiplayer/MultiplayerContext';
import { useGameContext } from '../context/GameContext';
import { ArrowLeft, Copy, Check } from 'lucide-react';

export default function LobbyScreen() {
  const { navigate } = useHashRouter();
  const { room, players, isHost, sendAction, onGameAction, leaveRoom } = useMultiplayer();
  const { startGame } = useGameContext();
  const [copied, setCopied] = useState(false);

  // If no room, go back to home
  useEffect(() => {
    if (!room) navigate('home');
  }, [room, navigate]);

  // Listen for game-start action from host
  useEffect(() => {
    if (!room || isHost) return;
    onGameAction((action) => {
      if (action.type === 'game-start' && action.payload) {
        const p = action.payload as { modeId: string; players: { id: string; name: string; isHost: boolean }[] };
        startGame(p.modeId, p.players, 'online');
        navigate('game', { modeId: p.modeId, playType: 'online' });
      }
    });
  }, [room, isHost, onGameAction, startGame, navigate]);

  const handleStartGame = useCallback(() => {
    if (!room || !isHost) return;
    const gamePlayers = players.map((p) => ({ id: p.id, name: p.name, isHost: p.isHost }));
    sendAction('game-start', { modeId: 'kniffel', players: gamePlayers });
    startGame('kniffel', gamePlayers, 'online');
    navigate('game', { modeId: 'kniffel', playType: 'online' });
  }, [room, isHost, players, sendAction, startGame, navigate]);

  const handleCopyCode = useCallback(async () => {
    if (!room) return;
    const url = `${window.location.origin}${window.location.pathname}#lobby?roomId=${room.roomId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      await navigator.clipboard.writeText(room.roomId);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [room]);

  const handleBack = useCallback(() => {
    leaveRoom();
    navigate('home');
  }, [leaveRoom, navigate]);

  if (!room) return null;

  return (
    <div className="lobby-screen">
      <div className="lobby-topbar">
        <button className="adaptive button button--icon-only" data-interactive="" data-material="transparent"
          aria-label="Zurück" onClick={handleBack}>
          <ArrowLeft className="icon" size={20} />
        </button>
        <h1 className="adaptive headline" data-level="3">Lobby</h1>
      </div>

      {isHost && (
        <div className="lobby-code-section">
          <span className="lobby-code-label">Raum-Code</span>
          <div className="lobby-code-row">
            <span className="lobby-code">{room.roomId}</span>
            <button className="adaptive button button--icon-only" data-interactive="" data-material="filled"
              aria-label="Code kopieren" onClick={handleCopyCode}>
              {copied ? <Check className="icon" size={18} /> : <Copy className="icon" size={18} />}
            </button>
          </div>
        </div>
      )}

      <div className="lobby-players">
        <h2 className="adaptive headline" data-level="5">Spieler ({players.length})</h2>
        <ul className="lobby-player-list">
          {players.map((p) => (
            <li key={p.id} className="adaptive lobby-player-item" data-material="filled-2">
              <span>{p.name}</span>
              {p.isHost && <span className="adaptive badge" data-material="inverted" data-relation="smaller">Host</span>}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <button className="adaptive button button--full-width" data-interactive=""
          data-material="inverted" data-container-contrast="max" data-size="l"
          disabled={players.length < 1} onClick={handleStartGame}>
          Spiel starten ({players.length} Spieler)
        </button>
      ) : (
        <p className="lobby-waiting">Warte auf Host...</p>
      )}
    </div>
  );
}

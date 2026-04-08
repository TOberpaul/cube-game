import { useState, useCallback, useEffect } from 'react';
import { useHashRouter } from '../hooks/useHashRouter';
import { useMultiplayer } from '../multiplayer/MultiplayerContext';
import { useGameContext } from '../context/GameContext';
import { ArrowLeft, Copy, Check } from 'lucide-react';

export default function LobbyScreen() {
  const { params, navigate } = useHashRouter();
  const { room, players, isHost, hostCreateRoom, clientJoinRoom, sendAction, onGameAction } = useMultiplayer();
  const { startGame } = useGameContext();
  const [playerName, setPlayerName] = useState('Spieler');
  const [joinCode, setJoinCode] = useState(params.roomId || '');
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState<'setup' | 'waiting'>(room ? 'waiting' : 'setup');

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

  const handleCreate = useCallback(() => {
    const name = playerName.trim() || 'Spieler';
    hostCreateRoom(name);
    setPhase('waiting');
  }, [playerName, hostCreateRoom]);

  const handleJoin = useCallback(() => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    const name = playerName.trim() || 'Spieler';
    clientJoinRoom(code, name);
    setPhase('waiting');
  }, [joinCode, playerName, clientJoinRoom]);

  const handleStartGame = useCallback(() => {
    if (!room || !isHost) return;
    const gamePlayers = players.map((p) => ({ id: p.id, name: p.name, isHost: p.isHost }));
    // Broadcast game-start to all clients
    sendAction('game-start', { modeId: 'kniffel', players: gamePlayers });
    // Start locally for host
    startGame('kniffel', gamePlayers, 'online');
    navigate('game', { modeId: 'kniffel', playType: 'online' });
  }, [room, isHost, players, sendAction, startGame, navigate]);

  const handleCopyCode = useCallback(async () => {
    if (!room) return;
    const url = `${window.location.origin}${window.location.pathname}#lobby?roomId=${room.roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copy just the code
      await navigator.clipboard.writeText(room.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [room]);

  if (phase === 'setup') {
    return (
      <div className="lobby-screen">
        <div className="lobby-topbar">
          <button className="adaptive button button--icon-only" data-interactive="" data-material="transparent"
            aria-label="Zurück" onClick={() => navigate('home')}>
            <ArrowLeft className="icon" size={20} />
          </button>
          <h1 className="adaptive headline" data-level="3">Online Multiplayer</h1>
        </div>

        <label className="adaptive input">
          <span>Dein Name</span>
          <input type="text" className="adaptive input__field" data-material="filled-2" data-interactive=""
            value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Spieler" />
        </label>

        <button className="adaptive button button--full-width" data-interactive=""
          data-material="inverted" data-container-contrast="max" data-size="l"
          onClick={handleCreate}>Raum erstellen</button>

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
          data-material="filled" data-size="l" disabled={!joinCode.trim()}
          onClick={handleJoin}>Raum beitreten</button>
      </div>
    );
  }

  // Waiting / Lobby view
  return (
    <div className="lobby-screen">
      <div className="lobby-topbar">
        <button className="adaptive button button--icon-only" data-interactive="" data-material="transparent"
          aria-label="Zurück" onClick={() => { navigate('home'); }}>
          <ArrowLeft className="icon" size={20} />
        </button>
        <h1 className="adaptive headline" data-level="3">Lobby</h1>
      </div>

      {isHost && room && (
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
        <h2 className="adaptive headline" data-level="5">
          Spieler ({players.length})
        </h2>
        <ul className="lobby-player-list">
          {players.map((p) => (
            <li key={p.id} className="adaptive lobby-player-item" data-material="filled-2">
              <span>{p.name}</span>
              {p.isHost && <span className="adaptive badge" data-material="inverted">Host</span>}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <button className="adaptive button button--full-width" data-interactive=""
          data-material="inverted" data-container-contrast="max" data-size="l"
          disabled={players.length < 2} onClick={handleStartGame}>
          Spiel starten ({players.length} Spieler)
        </button>
      ) : (
        <p className="lobby-waiting">Warte auf Host...</p>
      )}
    </div>
  );
}

import { useState, useCallback } from 'react';
import { t } from '../hooks/useI18n';
import { useGameContext } from '../context/GameContext';
import { useHashRouter } from '../hooks/useHashRouter';
import { Plus, Minus } from 'lucide-react';

const MAX_PLAYERS = 8;

export default function PlayerSetup() {
  const { startGame } = useGameContext();
  const { navigate } = useHashRouter();
  const [names, setNames] = useState<string[]>(['Spieler 1']);

  const addPlayer = useCallback(() => {
    if (names.length >= MAX_PLAYERS) return;
    setNames((prev) => [...prev, `Spieler ${prev.length + 1}`]);
  }, [names.length]);

  const removePlayer = useCallback(() => {
    if (names.length <= 1) return;
    setNames((prev) => prev.slice(0, -1));
  }, [names.length]);

  const handleStart = useCallback(() => {
    const players = names.map((name, i) => ({
      id: `p${i + 1}`, name: name.trim() || `Spieler ${i + 1}`, isHost: i === 0,
    }));
    const playType = players.length === 1 ? 'solo' : 'local';
    startGame('kniffel', players, playType);
    navigate('game', { modeId: 'kniffel', playType });
  }, [names, startGame, navigate]);

  return (
    <div className="player-setup">
      <div className="player-setup">
        {names.map((name, i) => (
          <label key={i} className="adaptive input">
            <span>{`Spieler ${i + 1}`}</span>
            <input type="text" className="adaptive input__field" data-material="filled-2" data-interactive=""
              value={name} onChange={(e) => setNames((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
              placeholder={`Spieler ${i + 1}`} />
          </label>
        ))}
      </div>

      <div className="player-setup__actions">
        {names.length > 1 && (
          <button type="button" className="adaptive button" data-interactive="" data-material="filled"
            onClick={removePlayer}>
            <Minus className="icon" size={18} /> Spieler entfernen
          </button>
        )}
        {names.length < MAX_PLAYERS && (
          <button type="button" className="adaptive button" data-interactive="" data-material="filled"
            onClick={addPlayer}>
            <Plus className="icon" size={18} /> Spieler hinzufügen
          </button>
        )}
      </div>

      <button type="button" className="adaptive button button--full-width" data-interactive=""
        data-material="inverted" data-container-contrast="max"
        onClick={handleStart}>{t('home.startLocal')}</button>
    </div>
  );
}

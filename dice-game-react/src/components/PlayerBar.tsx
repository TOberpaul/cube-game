import type { Player, ScoreSheet } from '@pwa/game/game-engine';
import { getAvatar } from '@pwa/avatars';

export interface PlayerBarProps {
  players: Player[];
  currentPlayerIndex: number;
  scores: Record<string, ScoreSheet>;
}

export default function PlayerBar({ players, currentPlayerIndex, scores }: PlayerBarProps) {
  return (
    <div className="player-bar" role="list" aria-label="Spielerleiste">
      {players.map((player, index) => {
        const isActive = index === currentPlayerIndex;
        const totalScore = scores[player.id]?.totalScore ?? 0;
        return (
          <div key={player.id} role="listitem" aria-current={isActive ? 'true' : undefined}
            className={`player-bar__item ${isActive ? 'player-bar__item--active' : 'player-bar__item--inactive'}`}>
            <span className="player-bar__avatar-wrapper">
              <span className="player-bar__avatar" aria-hidden="true">{getAvatar(index)}</span>
              {isActive && <span className="adaptive badge player-bar__badge" data-material="inverted" data-container-contrast="max" aria-label="Am Zug">●</span>}
            </span>
            <span className="player-bar__name">{player.name}</span>
            <span className="player-bar__score">{totalScore}</span>
          </div>
        );
      })}
    </div>
  );
}

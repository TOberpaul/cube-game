import { useEffect, useState } from 'react';
import { useGameContext } from '../context/GameContext';
import { useHashRouter } from '../hooks/useHashRouter';
import { t } from '../hooks/useI18n';
import { getAvatar } from '@pwa/avatars';
import type { GameState, Player } from '@pwa/game/game-engine';

export interface RankedPlayer { player: Player; avatar: string; totalScore: number; rank: number; }

export function computeRankings(gameState: GameState): RankedPlayer[] {
  const ranked = gameState.players.map((player, index) => ({
    player, avatar: getAvatar(index), totalScore: gameState.scores[player.id]?.totalScore ?? 0, rank: 0,
  }));
  ranked.sort((a, b) => b.totalScore - a.totalScore);
  for (let i = 0; i < ranked.length; i++) {
    ranked[i]!.rank = i === 0 ? 1 : (ranked[i]!.totalScore === ranked[i - 1]!.totalScore ? ranked[i - 1]!.rank : i + 1);
  }
  return ranked;
}

export default function ResultScreen() {
  const { gameState, loadGame, storeReady } = useGameContext();
  const { params, navigate } = useHashRouter();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (gameState) return;
    if (!params.gameId) { setError(true); return; }
    if (!storeReady) return;
    setLoading(true);
    loadGame(params.gameId).then(() => setLoading(false)).catch(() => { setError(true); setLoading(false); });
  }, [gameState, params.gameId, storeReady, loadGame]);

  if (error) return (
    <div className="result-screen" data-result-error="">
      <h1>{t('result.title')}</h1>
      <p className="result-screen__error">{t('error.gameNotFound')}</p>
      <button className="adaptive button" data-interactive="" data-material="filled" onClick={() => navigate('home')}>{t('result.backToHome')}</button>
    </div>
  );

  if (loading || !gameState) return (
    <div className="result-screen"><h1>{t('result.title')}</h1><p>{t('app.loading')}</p></div>
  );

  const rankings = computeRankings(gameState);

  return (
    <div className="result-screen" data-result-screen="">
      <h1>{t('result.title')}</h1>
      <ol className="result-list" aria-label={t('result.title')}>
        {rankings.map((entry) => (
          <li key={entry.player.id} className="result-item" data-result-player="" data-rank={entry.rank}>
            <span className="result-item__rank">{t('result.placement', { rank: entry.rank })}</span>
            <span aria-hidden="true">{entry.avatar}</span>
            <span className="result-item__name">{entry.player.name}</span>
            <span className="result-item__score">{t('result.finalScore', { points: entry.totalScore })}</span>
          </li>
        ))}
      </ol>
      <div className="result-actions">
        <button className="adaptive button" data-interactive="" data-material="inverted" data-container-contrast="max" data-size="l"
          onClick={() => navigate('home')}>{t('result.newGame')}</button>
      </div>
    </div>
  );
}

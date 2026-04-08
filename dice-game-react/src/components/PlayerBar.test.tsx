import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import PlayerBar from './PlayerBar';
import type { Player, ScoreSheet } from '@pwa/game/game-engine';

// Mock the avatars module
vi.mock('@pwa/avatars', () => ({
  AVATARS: ['🐸', '🐼', '🦊', '🐰', '🐱', '🐶', '🦁', '🐨'],
  getAvatar: (index: number) => ['🐸', '🐼', '🦊', '🐰', '🐱', '🐶', '🦁', '🐨'][index % 8],
}));

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    name: `Spieler ${i + 1}`,
    connectionStatus: 'connected' as const,
    isHost: i === 0,
  }));
}

function makeScores(players: Player[], totals: number[]): Record<string, ScoreSheet> {
  const scores: Record<string, ScoreSheet> = {};
  players.forEach((p, i) => {
    scores[p.id] = {
      playerId: p.id,
      totalScore: totals[i] ?? 0,
      categories: {},
    };
  });
  return scores;
}

function renderBar(props: { players: Player[]; currentPlayerIndex: number; scores: Record<string, ScoreSheet> }) {
  const { container } = render(<PlayerBar {...props} />);
  const bar = container.firstElementChild as HTMLElement;
  const items = Array.from(bar.querySelectorAll('[role="listitem"]')) as HTMLElement[];
  return { container, bar, items };
}

describe('PlayerBar', () => {
  it('renders one entry per player', () => {
    const players = makePlayers(3);
    const scores = makeScores(players, [10, 20, 30]);
    const { items } = renderBar({ players, currentPlayerIndex: 0, scores });

    expect(items).toHaveLength(3);
  });

  it('displays player name and score for each player', () => {
    const players = makePlayers(2);
    const scores = makeScores(players, [42, 99]);
    const { items } = renderBar({ players, currentPlayerIndex: 0, scores });

    expect(items[0]?.textContent).toContain('Spieler 1');
    expect(items[0]?.textContent).toContain('42');
    expect(items[1]?.textContent).toContain('Spieler 2');
    expect(items[1]?.textContent).toContain('99');
  });

  it('displays avatar emoji for each player', () => {
    const players = makePlayers(2);
    const scores = makeScores(players, [0, 0]);
    const { items } = renderBar({ players, currentPlayerIndex: 0, scores });

    expect(items[0]?.textContent).toContain('🐸');
    expect(items[1]?.textContent).toContain('🐼');
  });

  it('highlights the active player with data-emphasis="strong"', () => {
    const players = makePlayers(3);
    const scores = makeScores(players, [0, 0, 0]);
    const { items } = renderBar({ players, currentPlayerIndex: 1, scores });

    expect(items[0]?.getAttribute('data-emphasis')).toBeNull();
    expect(items[1]?.getAttribute('data-emphasis')).toBe('strong');
    expect(items[2]?.getAttribute('data-emphasis')).toBeNull();
  });

  it('sets aria-current on the active player', () => {
    const players = makePlayers(2);
    const scores = makeScores(players, [0, 0]);
    const { items } = renderBar({ players, currentPlayerIndex: 0, scores });

    expect(items[0]?.getAttribute('aria-current')).toBe('true');
    expect(items[1]?.getAttribute('aria-current')).toBeNull();
  });

  it('uses .adaptive class on the container and player entries', () => {
    const players = makePlayers(1);
    const scores = makeScores(players, [0]);
    const { bar, items } = renderBar({ players, currentPlayerIndex: 0, scores });

    expect(bar.classList.contains('adaptive')).toBe(true);
    expect(items[0]?.classList.contains('adaptive')).toBe(true);
  });

  it('shows 0 score when player has no score entry', () => {
    const players = makePlayers(1);
    const scores: Record<string, ScoreSheet> = {};
    const { items } = renderBar({ players, currentPlayerIndex: 0, scores });

    expect(items[0]?.textContent).toContain('0');
  });
});

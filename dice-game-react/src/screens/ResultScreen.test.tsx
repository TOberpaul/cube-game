import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import type { GameState, Player, ScoreSheet } from '@pwa/game/game-engine';

// Mock @pwa/i18n
vi.mock('@pwa/i18n', () => ({
  setLocale: vi.fn().mockResolvedValue(undefined),
  t: (key: string, params?: Record<string, unknown>) => {
    if (params) {
      let result = key;
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v));
      }
      return result;
    }
    return key;
  },
  getLocale: () => 'de',
  loadMessages: vi.fn(),
}));

// Mock @pwa/avatars
vi.mock('@pwa/avatars', () => ({
  AVATARS: ['🐸', '🐼', '🦊', '🐰', '🐱', '🐶', '🦁', '🐨'],
  getAvatar: (index: number) => ['🐸', '🐼', '🦊', '🐰', '🐱', '🐶', '🦁', '🐨'][index % 8],
}));

// Mock navigate
const mockNavigate = vi.fn();
let mockParams: Record<string, string> = {};
vi.mock('../hooks/useHashRouter', () => ({
  useHashRouter: () => ({
    route: 'result' as const,
    params: mockParams,
    navigate: mockNavigate,
  }),
}));

// Mock GameContext
let mockGameState: GameState | null = null;
const mockLoadGame = vi.fn();
let mockStoreReady = true;

vi.mock('../context/GameContext', () => ({
  useGameContext: () => ({
    gameState: mockGameState,
    loadGame: mockLoadGame,
    storeReady: mockStoreReady,
  }),
}));

import ResultScreen, { computeRankings } from './ResultScreen';

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
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

function makeGameState(playerCount: number, totals: number[]): GameState {
  const players = makePlayers(playerCount);
  return {
    gameId: 'test-game-1',
    modeId: 'kniffel',
    status: 'finished',
    players,
    currentPlayerIndex: 0,
    currentRound: 13,
    maxRounds: 13,
    dice: { values: [1, 2, 3, 4, 5], held: [false, false, false, false, false], count: 5 },
    rollsThisTurn: 0,
    scores: makeScores(players, totals),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

beforeEach(() => {
  mockGameState = null;
  mockParams = {};
  mockStoreReady = true;
  mockNavigate.mockClear();
  mockLoadGame.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('computeRankings', () => {
  it('sorts players by total score descending', () => {
    const state = makeGameState(3, [100, 250, 150]);
    const rankings = computeRankings(state);

    expect(rankings[0]!.player.name).toBe('Player 2');
    expect(rankings[1]!.player.name).toBe('Player 3');
    expect(rankings[2]!.player.name).toBe('Player 1');
  });

  it('assigns same rank to players with equal scores', () => {
    const state = makeGameState(3, [200, 200, 100]);
    const rankings = computeRankings(state);

    expect(rankings[0]!.rank).toBe(1);
    expect(rankings[1]!.rank).toBe(1);
    expect(rankings[2]!.rank).toBe(3);
  });

  it('includes avatars for each player', () => {
    const state = makeGameState(2, [50, 100]);
    const rankings = computeRankings(state);

    expect(rankings[0]!.avatar).toBeTruthy();
    expect(rankings[1]!.avatar).toBeTruthy();
  });
});

describe('ResultScreen', () => {
  it('displays rankings when game state is available', () => {
    mockGameState = makeGameState(2, [300, 150]);
    const { container } = render(<ResultScreen />);

    const items = container.querySelectorAll('[data-result-player]');
    expect(items).toHaveLength(2);
    // First player has higher score, so sorted first
    expect(items[0]?.textContent).toContain('Player 1');
    expect(items[1]?.textContent).toContain('Player 2');
    // Check rank data attributes
    expect(items[0]?.getAttribute('data-rank')).toBe('1');
    expect(items[1]?.getAttribute('data-rank')).toBe('2');
  });

  it('shows error state when no gameId and no game state', async () => {
    mockGameState = null;
    mockParams = {};
    const { container } = render(<ResultScreen />);

    await waitFor(() => {
      expect(container.querySelector('[data-result-error]')).not.toBeNull();
      expect(container.textContent).toContain('error.gameNotFound');
    });
  });

  it('shows "Zurück zum Start" button in error state that navigates home', async () => {
    mockGameState = null;
    mockParams = {};
    const { container } = render(<ResultScreen />);

    await waitFor(() => {
      const backBtn = container.querySelector('[data-result-back]') as HTMLElement;
      expect(backBtn).not.toBeNull();
      fireEvent.click(backBtn);
      expect(mockNavigate).toHaveBeenCalledWith('home');
    });
  });

  it('"Neues Spiel" button navigates to home', () => {
    mockGameState = makeGameState(2, [100, 200]);
    const { container } = render(<ResultScreen />);

    const newGameBtn = container.querySelector('[data-result-new-game]') as HTMLElement;
    expect(newGameBtn).not.toBeNull();
    fireEvent.click(newGameBtn);
    expect(mockNavigate).toHaveBeenCalledWith('home');
  });

  it('tries to load game from store when gameId param is present', () => {
    mockGameState = null;
    mockParams = { gameId: 'saved-game-123' };
    mockLoadGame.mockResolvedValue(undefined);

    render(<ResultScreen />);

    expect(mockLoadGame).toHaveBeenCalledWith('saved-game-123');
  });

  it('shows error when loadGame fails', async () => {
    mockGameState = null;
    mockParams = { gameId: 'bad-game' };
    mockLoadGame.mockRejectedValue(new Error('Not found'));

    const { container } = render(<ResultScreen />);

    await waitFor(() => {
      expect(container.querySelector('[data-result-error]')).not.toBeNull();
    });
  });

  it('uses .adaptive class on container and list items', () => {
    mockGameState = makeGameState(2, [100, 200]);
    const { container } = render(<ResultScreen />);

    const screen = container.querySelector('[data-result-screen]');
    expect(screen?.classList.contains('adaptive')).toBe(true);

    const items = container.querySelectorAll('[data-result-player]');
    items.forEach((item) => {
      expect(item.classList.contains('adaptive')).toBe(true);
    });
  });
});

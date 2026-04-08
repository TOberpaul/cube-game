import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GameProvider, useGameContext } from './GameContext';

// Shared mock store instance so tests can inspect calls
const mockStore = {
  save: vi.fn((_state: any) => Promise.resolve()),
  load: vi.fn(() => Promise.resolve(null)),
  listActive: vi.fn(() => Promise.resolve([])),
  listFinished: vi.fn(() => Promise.resolve([])),
  delete: vi.fn(() => Promise.resolve()),
};

// Mock the async createGameStore to avoid IndexedDB in tests
vi.mock('@pwa/store/game-store', () => ({
  createGameStore: vi.fn(() => Promise.resolve(mockStore)),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <GameProvider>{children}</GameProvider>;
}

describe('GameContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides initial null gameState', () => {
    const { result } = renderHook(() => useGameContext(), { wrapper });
    expect(result.current.gameState).toBeNull();
  });

  it('provides a registry with registered game modes', () => {
    const { result } = renderHook(() => useGameContext(), { wrapper });
    const modes = result.current.registry.getAll();
    const modeIds = modes.map((m) => m.id);
    expect(modeIds).toContain('kniffel');
    expect(modeIds).toContain('free-roll');
  });

  it('throws when useGameContext is used outside provider', () => {
    expect(() => {
      renderHook(() => useGameContext());
    }).toThrow('useGameContext must be used within a GameProvider');
  });

  it('startGame creates a game and updates gameState', () => {
    const { result } = renderHook(() => useGameContext(), { wrapper });

    act(() => {
      result.current.startGame('kniffel', [{ id: 'p1', name: 'Alice' }], 'solo');
    });

    expect(result.current.gameState).not.toBeNull();
    expect(result.current.gameState!.modeId).toBe('kniffel');
    expect(result.current.gameState!.status).toBe('playing');
    expect(result.current.gameState!.players).toHaveLength(1);
    expect(result.current.gameState!.players[0]!.name).toBe('Alice');
  });

  it('roll updates dice values in gameState', () => {
    const { result } = renderHook(() => useGameContext(), { wrapper });

    act(() => {
      result.current.startGame('free-roll', [{ id: 'p1', name: 'Bob' }], 'solo');
    });

    act(() => {
      result.current.roll();
    });

    expect(result.current.gameState!.rollsThisTurn).toBe(1);
    expect(result.current.gameState!.dice.values.length).toBeGreaterThan(0);
    // All dice values should be between 1 and 6
    for (const v of result.current.gameState!.dice.values) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it('toggleHold toggles the held state of a die after rolling', () => {
    const { result } = renderHook(() => useGameContext(), { wrapper });

    act(() => {
      result.current.startGame('kniffel', [{ id: 'p1', name: 'Charlie' }], 'solo');
    });

    act(() => {
      result.current.roll();
    });

    const heldBefore = result.current.gameState!.dice.held[0];

    act(() => {
      result.current.toggleHold(0);
    });

    expect(result.current.gameState!.dice.held[0]).toBe(!heldBefore);
  });

  it('resetDice changes dice count for free-roll mode', () => {
    const { result } = renderHook(() => useGameContext(), { wrapper });

    act(() => {
      result.current.startGame('free-roll', [{ id: 'p1', name: 'Dave' }], 'solo');
    });

    act(() => {
      result.current.resetDice(3);
    });

    expect(result.current.gameState!.dice.count).toBe(3);
    expect(result.current.gameState!.dice.values).toHaveLength(3);
    expect(result.current.gameState!.dice.held).toHaveLength(3);
    expect(result.current.gameState!.rollsThisTurn).toBe(0);
  });

  it('selectScore applies score and advances turn in kniffel', () => {
    const { result } = renderHook(() => useGameContext(), { wrapper });

    act(() => {
      result.current.startGame('kniffel', [
        { id: 'p1', name: 'Eve' },
        { id: 'p2', name: 'Frank' },
      ], 'local');
    });

    act(() => {
      result.current.roll();
    });

    // Select the "chance" category (always available, scores sum of dice)
    act(() => {
      result.current.selectScore({ id: 'chance', name: 'kniffel.chance', score: 15 });
    });

    // Should have advanced to next player
    expect(result.current.gameState!.currentPlayerIndex).toBe(1);
    expect(result.current.gameState!.rollsThisTurn).toBe(0);
    // Score should be recorded
    expect(result.current.gameState!.scores['p1']!.categories['chance']).toBe(15);
  });

  it('roll throws when no game engine is active', () => {
    const { result } = renderHook(() => useGameContext(), { wrapper });

    expect(() => {
      act(() => {
        result.current.roll();
      });
    }).toThrow('Cannot roll: no active game engine');
  });

  it('storeReady becomes true after initialization', async () => {
    const { result } = renderHook(() => useGameContext(), { wrapper });

    // Initially might be false, but should become true after async init
    await vi.waitFor(() => {
      expect(result.current.storeReady).toBe(true);
    });
  });

  // --- Persistence tests (Req 7.2, 7.3) ---

  it('saves game state to store after startGame', async () => {
    const { result } = renderHook(() => useGameContext(), { wrapper });

    // Wait for store to be ready
    await vi.waitFor(() => {
      expect(result.current.storeReady).toBe(true);
    });

    mockStore.save.mockClear();

    act(() => {
      result.current.startGame('kniffel', [{ id: 'p1', name: 'Alice' }], 'solo');
    });

    // The useEffect watching gameState should trigger save
    await vi.waitFor(() => {
      expect(mockStore.save).toHaveBeenCalled();
    });

    const savedState = mockStore.save.mock.calls[0]![0] as any;
    expect(savedState.modeId).toBe('kniffel');
    expect(savedState.status).toBe('playing');
  });

  it('saves game state to store after roll', async () => {
    const { result } = renderHook(() => useGameContext(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.storeReady).toBe(true);
    });

    act(() => {
      result.current.startGame('free-roll', [{ id: 'p1', name: 'Bob' }], 'solo');
    });

    // Wait for initial save from startGame
    await vi.waitFor(() => {
      expect(mockStore.save).toHaveBeenCalled();
    });

    mockStore.save.mockClear();

    act(() => {
      result.current.roll();
    });

    await vi.waitFor(() => {
      expect(mockStore.save).toHaveBeenCalled();
    });

    const savedState = mockStore.save.mock.calls[0]![0] as any;
    expect(savedState.rollsThisTurn).toBe(1);
  });

  it('saves game state to store after toggleHold', async () => {
    const { result } = renderHook(() => useGameContext(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.storeReady).toBe(true);
    });

    act(() => {
      result.current.startGame('kniffel', [{ id: 'p1', name: 'Charlie' }], 'solo');
    });

    act(() => {
      result.current.roll();
    });

    await vi.waitFor(() => {
      expect(mockStore.save).toHaveBeenCalled();
    });

    mockStore.save.mockClear();

    act(() => {
      result.current.toggleHold(0);
    });

    await vi.waitFor(() => {
      expect(mockStore.save).toHaveBeenCalled();
    });

    const savedState = mockStore.save.mock.calls[0]![0] as any;
    expect(savedState.dice.held[0]).toBe(true);
  });

  it('saves game state to store after selectScore', async () => {
    const { result } = renderHook(() => useGameContext(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.storeReady).toBe(true);
    });

    act(() => {
      result.current.startGame('kniffel', [{ id: 'p1', name: 'Eve' }], 'solo');
    });

    act(() => {
      result.current.roll();
    });

    await vi.waitFor(() => {
      expect(mockStore.save).toHaveBeenCalled();
    });

    mockStore.save.mockClear();

    act(() => {
      result.current.selectScore({ id: 'chance', name: 'kniffel.chance', score: 15 });
    });

    await vi.waitFor(() => {
      expect(mockStore.save).toHaveBeenCalled();
    });

    const savedState = mockStore.save.mock.calls[0]![0] as any;
    expect(savedState.scores['p1'].categories['chance']).toBe(15);
  });

  it('saves finished status when game ends (Req 7.3)', async () => {
    const { result } = renderHook(() => useGameContext(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.storeReady).toBe(true);
    });

    // Start a kniffel game with 1 player — fill all 13 categories to finish
    act(() => {
      result.current.startGame('kniffel', [{ id: 'p1', name: 'Solo' }], 'solo');
    });

    const categories = [
      'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
      'threeOfAKind', 'fourOfAKind', 'fullHouse', 'smallStraight',
      'largeStraight', 'yahtzee', 'chance',
    ];

    for (const cat of categories) {
      act(() => {
        result.current.roll();
      });
      act(() => {
        result.current.selectScore({ id: cat, name: `kniffel.${cat}`, score: 0 });
      });
    }

    // After filling all 13 categories, the game should be finished
    expect(result.current.gameState!.status).toBe('finished');

    // The useEffect persists every gameState change, so the finished state was saved
    await vi.waitFor(() => {
      const finishedSave = mockStore.save.mock.calls.find(
        (call: any[]) => call[0]?.status === 'finished'
      );
      expect(finishedSave).toBeDefined();
    });
  });
});

// Feature: dice-game-pwa, Property 6: Aktive-Spiele-Filter
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { createGameStore } from '../js/store/game-store.js';

/**
 * **Validates: Requirements 6.5**
 *
 * Property 6: Aktive-Spiele-Filter
 * For every set of saved games: listActive() returns exclusively non-finished games,
 * no active game is missing from the result.
 */

// Use a run counter to generate unique game IDs across iterations
let runCounter = 0;

// Arbitrary for a list of 1-10 statuses
const statusListArb = fc.array(
  fc.constantFrom('lobby', 'playing', 'finished'),
  { minLength: 1, maxLength: 10 }
);

function makeGame(gameId, status) {
  return {
    gameId,
    modeId: 'free-roll',
    status,
    players: [{ id: 'p1', name: 'Player', connectionStatus: 'connected', isHost: true }],
    currentPlayerIndex: 0,
    currentRound: 1,
    maxRounds: null,
    dice: { values: [1], held: [false], count: 1 },
    rollsThisTurn: 0,
    scores: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('Property 6: Aktive-Spiele-Filter', () => {
  beforeEach(() => {
    const req = indexedDB.deleteDatabase('dice-game-pwa');
    return new Promise((resolve) => {
      req.onsuccess = resolve;
      req.onerror = resolve;
    });
  });

  it('listActive() returns exclusively non-finished games, no active game is missing', async () => {
    const store = await createGameStore();

    await fc.assert(
      fc.asyncProperty(statusListArb, async (statuses) => {
        // Generate unique IDs for this iteration to avoid collisions
        const prefix = `run${runCounter++}`;
        const games = statuses.map((status, i) => makeGame(`${prefix}-game-${i}`, status));

        // Save all games
        for (const game of games) {
          await store.save(game);
        }

        const activeResult = await store.listActive();

        // Collect only games from THIS iteration
        const thisRunIds = new Set(games.map((g) => g.gameId));
        const thisRunActive = activeResult.filter((g) => thisRunIds.has(g.gameId));

        const expectedActive = games.filter((g) => g.status !== 'finished');

        // 1. All returned games from this run must be non-finished
        for (const game of thisRunActive) {
          expect(game.status).not.toBe('finished');
        }

        // 2. Count must match — no active game is missing
        expect(thisRunActive.length).toBe(expectedActive.length);

        // 3. Every expected active game is present in the result
        const resultIds = new Set(thisRunActive.map((g) => g.gameId));
        for (const game of expectedActive) {
          expect(resultIds.has(game.gameId)).toBe(true);
        }

        // Cleanup: delete games from this iteration
        for (const game of games) {
          await store.delete(game.gameId);
        }
      }),
      { numRuns: 100 }
    );
  }, 30000);
});

// Feature: dice-game-pwa, Property 5: Spielstand-Serialisierung Round-Trip
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { createGameStore } from '../js/store/game-store.js';

/**
 * **Validates: Requirements 6.4**
 *
 * Property 5: Spielstand-Serialisierung Round-Trip
 * For every valid GameState: save() + load(gameId) returns semantically identical state.
 */

// Arbitrary for a Player object
const playerArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  connectionStatus: fc.constantFrom('connected', 'disconnected'),
  isHost: fc.boolean(),
});

// Arbitrary for a PlayerScoreSheet
const playerScoreSheetArb = (playerId) =>
  fc.record({
    playerId: fc.constant(playerId),
    totalScore: fc.integer({ min: 0, max: 1000 }),
    categories: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 15 }).filter((s) => s.trim().length > 0),
      fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 100 })),
      { minKeys: 0, maxKeys: 13 }
    ),
  });

// Arbitrary for DiceState
const diceStateArb = fc.integer({ min: 1, max: 6 }).chain((count) =>
  fc.record({
    values: fc.array(fc.integer({ min: 1, max: 6 }), { minLength: count, maxLength: count }),
    held: fc.array(fc.boolean(), { minLength: count, maxLength: count }),
    count: fc.constant(count),
  })
);

// Arbitrary for a full GameState
const gameStateArb = fc
  .tuple(
    fc.uuid(),
    fc.constantFrom('kniffel', 'free-roll', 'custom-mode'),
    fc.constantFrom('lobby', 'playing', 'finished'),
    fc.array(playerArb, { minLength: 1, maxLength: 4 }),
    diceStateArb,
    fc.integer({ min: 0, max: 20 }),
    fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 100 })),
    fc.nat({ max: 2000000000 }),
    fc.nat({ max: 2000000000 })
  )
  .chain(([gameId, modeId, status, players, dice, rollsThisTurn, maxRounds, createdAt, updatedAt]) => {
    const currentPlayerIndex = players.length > 0 ? fc.integer({ min: 0, max: players.length - 1 }) : fc.constant(0);

    // Build scores arbitraries for each player
    const scoresEntries = players.map((p) => playerScoreSheetArb(p.id).map((sheet) => [p.id, sheet]));

    return fc.tuple(currentPlayerIndex, fc.tuple(...scoresEntries)).map(([cpIdx, entries]) => ({
      gameId,
      modeId,
      status,
      players,
      currentPlayerIndex: cpIdx,
      currentRound: 1,
      maxRounds,
      dice,
      rollsThisTurn,
      scores: Object.fromEntries(entries),
      createdAt,
      updatedAt,
    }));
  });

describe('Property 5: Spielstand-Serialisierung Round-Trip', () => {
  // Reset fake-indexeddb between runs to avoid cross-test pollution
  beforeEach(() => {
    // Delete all databases by resetting indexedDB internals
    const req = indexedDB.deleteDatabase('dice-game-pwa');
    return new Promise((resolve) => {
      req.onsuccess = resolve;
      req.onerror = resolve;
    });
  });

  it('save() + load(gameId) returns semantically identical state', async () => {
    await fc.assert(
      fc.asyncProperty(gameStateArb, async (gameState) => {
        const store = await createGameStore();

        await store.save(gameState);
        const loaded = await store.load(gameState.gameId);

        expect(loaded).toEqual(gameState);
      }),
      { numRuns: 100 }
    );
  });
});

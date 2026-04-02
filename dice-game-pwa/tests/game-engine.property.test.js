// Feature: dice-game-pwa, Property 4: Endpunktzahlen-Sortierung
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { freeRollMode } from '../js/game/modes/free-roll.js';
import { kniffelMode } from '../js/game/modes/kniffel.js';

/**
 * **Validates: Requirements 6.3**
 *
 * Property 4: Endpunktzahlen-Sortierung
 * For every completed game state with 1-8 players and random total scores (0-500):
 * - getFinalScores() returns results sorted in descending order by totalScore
 * - Players with equal totalScore have equal rank
 * - Ranks are valid: start at 1, no gaps except for ties
 */

// Arbitrary: generate a game state with 1-8 players, each with a random totalScore
const gameStateArb = fc
  .integer({ min: 1, max: 8 })
  .chain((playerCount) =>
    fc
      .array(fc.integer({ min: 0, max: 500 }), {
        minLength: playerCount,
        maxLength: playerCount,
      })
      .map((totalScores) => {
        const players = totalScores.map((_, i) => ({
          id: `player-${i}`,
          name: `Player ${i}`,
          connectionStatus: 'connected',
          isHost: i === 0,
        }));

        const scores = {};
        players.forEach((p, i) => {
          scores[p.id] = {
            playerId: p.id,
            totalScore: totalScores[i],
            categories: {},
          };
        });

        return {
          gameId: 'test-game',
          modeId: 'free-roll',
          status: 'finished',
          players,
          currentPlayerIndex: 0,
          currentRound: 1,
          maxRounds: null,
          dice: { values: [], held: [], count: 6 },
          rollsThisTurn: 0,
          scores,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      })
  );

function assertFinalScoresSorted(result, playerCount) {
  // Must return exactly as many entries as players
  expect(result).toHaveLength(playerCount);

  // 1. Descending order by totalScore
  for (let i = 1; i < result.length; i++) {
    expect(result[i].totalScore).toBeLessThanOrEqual(result[i - 1].totalScore);
  }

  // 2. Equal totalScore → equal rank
  for (let i = 1; i < result.length; i++) {
    if (result[i].totalScore === result[i - 1].totalScore) {
      expect(result[i].rank).toBe(result[i - 1].rank);
    }
  }

  // 3. Ranks start at 1
  expect(result[0].rank).toBe(1);

  // 4. Ranks are valid: no gaps except for ties
  //    After a group of tied players at rank R with size S, the next rank must be R + S
  for (let i = 1; i < result.length; i++) {
    if (result[i].totalScore < result[i - 1].totalScore) {
      // Count how many players share the previous rank
      expect(result[i].rank).toBe(i + 1);
    }
  }
}

describe('Property 4: Endpunktzahlen-Sortierung', () => {
  it('freeRollMode.getFinalScores returns descending sort with correct ranks', () => {
    fc.assert(
      fc.property(gameStateArb, (state) => {
        const result = freeRollMode.scoring.getFinalScores(state);
        assertFinalScoresSorted(result, state.players.length);
      }),
      { numRuns: 100 }
    );
  });

  it('kniffelMode.getFinalScores returns descending sort with correct ranks', () => {
    fc.assert(
      fc.property(gameStateArb, (state) => {
        const result = kniffelMode.scoring.getFinalScores(state);
        assertFinalScoresSorted(result, state.players.length);
      }),
      { numRuns: 100 }
    );
  });
});

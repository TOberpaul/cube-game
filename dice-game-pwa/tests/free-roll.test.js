import { describe, it, expect } from 'vitest';
import { freeRollMode, registerFreeRoll } from '../js/game/modes/free-roll.js';
import { createGameModeRegistry } from '../js/game/game-mode-registry.js';

describe('Free Roll Mode', () => {
  it('has correct config values', () => {
    expect(freeRollMode.id).toBe('free-roll');
    expect(freeRollMode.name).toBe('mode.freeRoll');
    expect(freeRollMode.diceCount).toBe(6);
    expect(freeRollMode.maxPlayers).toBe(8);
    expect(freeRollMode.maxRounds).toBeNull();
    expect(freeRollMode.rollsPerTurn).toBeNull();
    expect(freeRollMode.scoring).toBeDefined();
  });

  describe('scoring.calculateOptions', () => {
    it('returns a single option with the sum of all dice', () => {
      const options = freeRollMode.scoring.calculateOptions([1, 2, 3, 4, 5, 6]);
      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({ id: 'sum', name: 'score.sum', score: 21 });
    });

    it('handles a single die', () => {
      const options = freeRollMode.scoring.calculateOptions([4]);
      expect(options[0].score).toBe(4);
    });
  });

  describe('scoring.applyScore', () => {
    it('adds score to the player total', () => {
      const state = {
        players: [{ id: 'p1', name: 'Alice' }],
        currentPlayerIndex: 0,
        scores: { p1: { playerId: 'p1', totalScore: 10, categories: {} } },
      };
      const newState = freeRollMode.scoring.applyScore({ id: 'sum', name: 'score.sum', score: 15 }, state);
      expect(newState.scores.p1.totalScore).toBe(25);
    });

    it('initializes score sheet if missing', () => {
      const state = {
        players: [{ id: 'p1', name: 'Alice' }],
        currentPlayerIndex: 0,
        scores: {},
      };
      const newState = freeRollMode.scoring.applyScore({ id: 'sum', name: 'score.sum', score: 7 }, state);
      expect(newState.scores.p1.totalScore).toBe(7);
    });
  });

  describe('scoring.isGameOver', () => {
    it('always returns false', () => {
      expect(freeRollMode.scoring.isGameOver()).toBe(false);
      expect(freeRollMode.scoring.isGameOver({})).toBe(false);
    });
  });

  describe('scoring.getFinalScores', () => {
    it('returns players sorted by total score descending', () => {
      const state = {
        players: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
          { id: 'p3', name: 'Carol' },
        ],
        scores: {
          p1: { playerId: 'p1', totalScore: 10 },
          p2: { playerId: 'p2', totalScore: 30 },
          p3: { playerId: 'p3', totalScore: 20 },
        },
      };
      const result = freeRollMode.scoring.getFinalScores(state);
      expect(result[0].playerId).toBe('p2');
      expect(result[1].playerId).toBe('p3');
      expect(result[2].playerId).toBe('p1');
    });

    it('assigns equal rank for tied scores', () => {
      const state = {
        players: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
        ],
        scores: {
          p1: { playerId: 'p1', totalScore: 20 },
          p2: { playerId: 'p2', totalScore: 20 },
        },
      };
      const result = freeRollMode.scoring.getFinalScores(state);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(1);
    });

    it('handles players with no scores', () => {
      const state = {
        players: [{ id: 'p1', name: 'Alice' }],
        scores: {},
      };
      const result = freeRollMode.scoring.getFinalScores(state);
      expect(result[0].totalScore).toBe(0);
    });
  });

  describe('registerFreeRoll', () => {
    it('registers the mode in the registry', () => {
      const registry = createGameModeRegistry();
      registerFreeRoll(registry);
      const mode = registry.get('free-roll');
      expect(mode).toBeDefined();
      expect(mode.id).toBe('free-roll');
      expect(mode.name).toBe('mode.freeRoll');
    });
  });
});

// Unit tests for Game Engine
// Feature: dice-game-pwa, Anforderungen: 4.1, 4.2, 6.2

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGameEngine } from '../js/game/game-engine.js';
import { createGameModeRegistry } from '../js/game/game-mode-registry.js';
import { registerFreeRoll } from '../js/game/modes/free-roll.js';
import { registerKniffel } from '../js/game/modes/kniffel.js';

function makeRegistry() {
  const registry = createGameModeRegistry();
  registerFreeRoll(registry);
  registerKniffel(registry);
  return registry;
}

const PLAYERS = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

describe('GameEngine', () => {
  let engine;
  let registry;

  beforeEach(() => {
    registry = makeRegistry();
    engine = createGameEngine(registry);
  });

  describe('startGame', () => {
    it('initializes a game with correct state', () => {
      const state = engine.startGame('free-roll', PLAYERS);

      expect(state.gameId).toBeTruthy();
      expect(state.modeId).toBe('free-roll');
      expect(state.status).toBe('playing');
      expect(state.players).toHaveLength(2);
      expect(state.currentPlayerIndex).toBe(0);
      expect(state.currentRound).toBe(1);
      expect(state.rollsThisTurn).toBe(0);
      expect(state.dice.count).toBe(6); // free-roll uses 6 dice
      expect(state.scores.p1).toBeDefined();
      expect(state.scores.p2).toBeDefined();
    });

    it('sets first player as host by default', () => {
      const state = engine.startGame('free-roll', PLAYERS);
      expect(state.players[0].isHost).toBe(true);
      expect(state.players[1].isHost).toBe(false);
    });

    it('respects explicit isHost flag', () => {
      const players = [
        { id: 'p1', name: 'Alice', isHost: false },
        { id: 'p2', name: 'Bob', isHost: true },
      ];
      const state = engine.startGame('free-roll', players);
      expect(state.players[0].isHost).toBe(false);
      expect(state.players[1].isHost).toBe(true);
    });

    it('throws for unknown game mode', () => {
      expect(() => engine.startGame('nonexistent', PLAYERS)).toThrow('Unknown game mode');
    });

    it('throws for empty players', () => {
      expect(() => engine.startGame('free-roll', [])).toThrow('At least one player');
    });

    it('throws when too many players', () => {
      const tooMany = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
      expect(() => engine.startGame('free-roll', tooMany)).toThrow('Too many players');
    });

    it('emits stateChange on start', () => {
      const handler = vi.fn();
      engine.on('stateChange', handler);
      engine.startGame('free-roll', PLAYERS);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('roll', () => {
    it('produces valid dice values', () => {
      engine.startGame('free-roll', PLAYERS);
      const result = engine.roll();

      expect(result.values).toHaveLength(6);
      for (const v of result.values) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
      }
    });

    it('increments rollsThisTurn', () => {
      engine.startGame('free-roll', PLAYERS);
      engine.roll();
      expect(engine.getState().rollsThisTurn).toBe(1);
      engine.roll();
      expect(engine.getState().rollsThisTurn).toBe(2);
    });

    it('throws when game is not playing', () => {
      expect(() => engine.roll()).toThrow('not in playing state');
    });

    it('enforces rolls-per-turn limit for kniffel', () => {
      engine.startGame('kniffel', PLAYERS);
      engine.roll();
      engine.roll();
      engine.roll();
      expect(() => engine.roll()).toThrow('Roll limit reached');
    });

    it('emits roll and stateChange events', () => {
      const rollHandler = vi.fn();
      const stateHandler = vi.fn();
      engine.on('roll', rollHandler);
      engine.on('stateChange', stateHandler);

      engine.startGame('free-roll', PLAYERS);
      stateHandler.mockClear(); // clear the startGame emission

      engine.roll();
      expect(rollHandler).toHaveBeenCalledTimes(1);
      expect(stateHandler).toHaveBeenCalledTimes(1);
    });

    it('updates dice values in state', () => {
      engine.startGame('free-roll', PLAYERS);
      const result = engine.roll();
      const state = engine.getState();
      expect(state.dice.values).toEqual(result.values);
    });
  });

  describe('toggleHold', () => {
    it('toggles hold state of a die', () => {
      engine.startGame('free-roll', PLAYERS);
      engine.roll(); // must roll before holding

      engine.toggleHold(0);
      expect(engine.getState().dice.held[0]).toBe(true);

      engine.toggleHold(0);
      expect(engine.getState().dice.held[0]).toBe(false);
    });

    it('does nothing before first roll', () => {
      engine.startGame('free-roll', PLAYERS);
      engine.toggleHold(0);
      expect(engine.getState().dice.held[0]).toBe(false);
    });

    it('ignores out-of-range index', () => {
      engine.startGame('free-roll', PLAYERS);
      engine.roll();
      engine.toggleHold(99);
      // Should not throw
      expect(engine.getState().dice.held.every((h) => h === false)).toBe(true);
    });
  });

  describe('nextTurn', () => {
    it('advances to next player', () => {
      engine.startGame('free-roll', PLAYERS);
      engine.roll();
      expect(engine.getState().currentPlayerIndex).toBe(0);

      engine.nextTurn();
      expect(engine.getState().currentPlayerIndex).toBe(1);
    });

    it('wraps around and increments round', () => {
      engine.startGame('free-roll', PLAYERS);
      engine.roll();
      engine.nextTurn(); // player 0 → 1
      engine.roll();
      engine.nextTurn(); // player 1 → 0, round 1 → 2

      const state = engine.getState();
      expect(state.currentPlayerIndex).toBe(0);
      expect(state.currentRound).toBe(2);
    });

    it('resets rollsThisTurn and dice on turn change', () => {
      engine.startGame('free-roll', PLAYERS);
      engine.roll();
      engine.roll();
      expect(engine.getState().rollsThisTurn).toBe(2);

      engine.nextTurn();
      expect(engine.getState().rollsThisTurn).toBe(0);
      expect(engine.getState().dice.held.every((h) => h === false)).toBe(true);
    });

    it('emits turnEnd and stateChange', () => {
      const turnEndHandler = vi.fn();
      const stateHandler = vi.fn();
      engine.on('turnEnd', turnEndHandler);
      engine.on('stateChange', stateHandler);

      engine.startGame('free-roll', PLAYERS);
      stateHandler.mockClear();

      engine.nextTurn();
      expect(turnEndHandler).toHaveBeenCalledTimes(1);
      expect(turnEndHandler).toHaveBeenCalledWith({ previousPlayerIndex: 0 });
      expect(stateHandler).toHaveBeenCalled();
    });
  });

  describe('selectScore', () => {
    it('applies score and advances turn', () => {
      engine.startGame('free-roll', PLAYERS);
      engine.roll();

      const state = engine.getState();
      const sum = state.dice.values.reduce((a, b) => a + b, 0);

      engine.selectScore({ id: 'sum', name: 'score.sum', score: sum });

      const newState = engine.getState();
      expect(newState.scores.p1.totalScore).toBe(sum);
      expect(newState.currentPlayerIndex).toBe(1); // advanced to next player
    });

    it('throws if no roll has been made', () => {
      engine.startGame('free-roll', PLAYERS);
      expect(() => engine.selectScore({ id: 'sum', name: 'score.sum', score: 10 })).toThrow(
        'Must roll at least once'
      );
    });

    it('throws when game is not playing', () => {
      expect(() => engine.selectScore({ id: 'sum', name: 'score.sum', score: 10 })).toThrow(
        'not in playing state'
      );
    });
  });

  describe('game over detection', () => {
    it('finishes game when kniffel isGameOver returns true', () => {
      engine.startGame('kniffel', [{ id: 'p1', name: 'Solo' }]);

      const gameOverHandler = vi.fn();
      engine.on('gameOver', gameOverHandler);

      // Fill all 13 categories for the solo player
      const categories = [
        'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
        'threeOfAKind', 'fourOfAKind', 'fullHouse',
        'smallStraight', 'largeStraight', 'kniffel', 'chance',
      ];

      for (const cat of categories) {
        // After selectScore on a solo game, nextTurn wraps and resets.
        // But the last selectScore triggers gameOver before nextTurn.
        if (engine.getState().status !== 'playing') break;
        engine.roll();
        engine.selectScore({ id: cat, name: `kniffel.${cat}`, score: 0 });
      }

      expect(engine.getState().status).toBe('finished');
      expect(gameOverHandler).toHaveBeenCalled();
    });
  });

  describe('round limit', () => {
    it('ends game when maxRounds is exceeded', () => {
      // Create a custom mode with 2 rounds
      const customRegistry = createGameModeRegistry();
      customRegistry.register({
        id: 'test-mode',
        name: 'Test',
        diceCount: 1,
        maxPlayers: 2,
        maxRounds: 2,
        rollsPerTurn: null,
        scoring: {
          calculateOptions: () => [],
          applyScore: (opt, state) => state,
          isGameOver: () => false,
          getFinalScores: () => [],
        },
      });

      const eng = createGameEngine(customRegistry);
      eng.startGame('test-mode', PLAYERS);

      const gameOverHandler = vi.fn();
      eng.on('gameOver', gameOverHandler);

      // Round 1: p1 → p2
      eng.nextTurn(); // p1 done
      eng.nextTurn(); // p2 done → round 2

      // Round 2: p1 → p2
      eng.nextTurn(); // p1 done
      eng.nextTurn(); // p2 done → round 3 > maxRounds → game over

      expect(eng.getState().status).toBe('finished');
      expect(gameOverHandler).toHaveBeenCalled();
    });
  });

  describe('getState', () => {
    it('returns null before game starts', () => {
      expect(engine.getState()).toBeNull();
    });

    it('returns a copy of the state', () => {
      engine.startGame('free-roll', PLAYERS);
      const s1 = engine.getState();
      const s2 = engine.getState();
      expect(s1).toEqual(s2);
      expect(s1).not.toBe(s2); // different references
    });
  });

  describe('disconnect / reconnect', () => {
    it('marks player as disconnected', () => {
      engine.startGame('free-roll', PLAYERS);
      const handler = vi.fn();
      engine.on('playerDisconnected', handler);

      engine.disconnectPlayer('p2');

      const state = engine.getState();
      expect(state.players[1].connectionStatus).toBe('disconnected');
      expect(handler).toHaveBeenCalledWith({ playerId: 'p2' });
    });

    it('marks player as reconnected', () => {
      engine.startGame('free-roll', PLAYERS);
      engine.disconnectPlayer('p2');

      const handler = vi.fn();
      engine.on('playerReconnected', handler);

      engine.reconnectPlayer('p2');

      const state = engine.getState();
      expect(state.players[1].connectionStatus).toBe('connected');
      expect(handler).toHaveBeenCalled();
    });

    it('game stays playing when a player disconnects', () => {
      engine.startGame('free-roll', PLAYERS);
      engine.disconnectPlayer('p2');
      expect(engine.getState().status).toBe('playing');
    });
  });

  describe('event system', () => {
    it('supports multiple handlers for same event', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      engine.on('stateChange', h1);
      engine.on('stateChange', h2);

      engine.startGame('free-roll', PLAYERS);
      expect(h1).toHaveBeenCalled();
      expect(h2).toHaveBeenCalled();
    });
  });
});

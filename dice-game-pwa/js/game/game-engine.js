// Game Engine — Spielablauf-Steuerung
// Feature: dice-game-pwa, Anforderungen: 4.1, 4.2, 6.2

import { createDiceEngine } from '../dice/dice-engine.js';

/**
 * Generates a UUID using crypto.randomUUID() with fallback.
 * @returns {string}
 */
function generateId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  // Fallback: simple pseudo-UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Creates a GameEngine instance.
 *
 * @param {object} registry - A GameModeRegistry instance
 * @param {object} [options]
 * @param {object} [options.diceEngineOptions] - Options passed to createDiceEngine
 * @returns {GameEngine}
 */
export function createGameEngine(registry, options = {}) {
  /** @type {object|null} */
  let state = null;
  /** @type {object|null} */
  let mode = null;
  /** @type {object|null} */
  let diceEngine = null;

  /** @type {Map<string, Function[]>} */
  const listeners = new Map();

  /**
   * Emits an event to all registered handlers.
   * @param {string} event
   * @param {*} data
   */
  function emit(event, data) {
    const handlers = listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  return {
    /**
     * Starts a new game with the given mode and players.
     * @param {string} modeId
     * @param {{ id: string, name: string, isHost?: boolean }[]} players
     * @returns {object} GameState
     */
    startGame(modeId, players) {
      mode = registry.get(modeId);
      if (!mode) {
        throw new Error(`Unknown game mode: ${modeId}`);
      }

      if (!players || players.length === 0) {
        throw new Error('At least one player is required');
      }

      if (players.length > mode.maxPlayers) {
        throw new Error(`Too many players: max ${mode.maxPlayers} for mode ${modeId}`);
      }

      diceEngine = createDiceEngine(options.diceEngineOptions);
      diceEngine.reset(mode.diceCount);

      const now = Date.now();
      const scores = {};
      const fullPlayers = players.map((p, i) => ({
        id: p.id,
        name: p.name,
        connectionStatus: 'connected',
        isHost: p.isHost ?? (i === 0),
      }));

      for (const p of fullPlayers) {
        scores[p.id] = { playerId: p.id, totalScore: 0, categories: {} };
      }

      state = {
        gameId: generateId(),
        modeId,
        status: 'playing',
        players: fullPlayers,
        currentPlayerIndex: 0,
        currentRound: 1,
        maxRounds: mode.maxRounds,
        dice: {
          values: new Array(mode.diceCount).fill(0),
          held: new Array(mode.diceCount).fill(false),
          count: mode.diceCount,
        },
        rollsThisTurn: 0,
        scores,
        createdAt: now,
        updatedAt: now,
      };

      emit('stateChange', { ...state });
      return { ...state };
    },

    /**
     * Rolls the dice. Enforces rolls-per-turn limit and playing status.
     * @returns {{ values: number[], rolledIndices: number[] }}
     */
    roll() {
      if (!state || state.status !== 'playing') {
        throw new Error('Cannot roll: game is not in playing state');
      }

      if (mode.rollsPerTurn !== null && state.rollsThisTurn >= mode.rollsPerTurn) {
        throw new Error(`Roll limit reached: max ${mode.rollsPerTurn} rolls per turn`);
      }

      // Build held indices set from the dice state
      const heldIndices = new Set();
      for (let i = 0; i < state.dice.held.length; i++) {
        if (state.dice.held[i]) {
          heldIndices.add(i);
        }
      }

      const result = diceEngine.roll(mode.diceCount, heldIndices);

      state.dice.values = [...result.values];
      state.rollsThisTurn++;
      state.updatedAt = Date.now();

      emit('roll', result);
      emit('stateChange', { ...state });
      return result;
    },

    /**
     * Selects a score option for the current player.
     * Applies the score via the mode's scoring strategy, then advances the turn.
     * @param {{ id: string, name: string, score: number }} option
     */
    selectScore(option) {
      if (!state || state.status !== 'playing') {
        throw new Error('Cannot select score: game is not in playing state');
      }

      if (state.rollsThisTurn === 0) {
        throw new Error('Must roll at least once before selecting a score');
      }

      // Apply score via the mode's scoring strategy
      state = mode.scoring.applyScore(option, state);
      state.updatedAt = Date.now();

      // Check if game is over
      if (mode.scoring.isGameOver(state)) {
        state.status = 'finished';
        emit('stateChange', { ...state });
        emit('gameOver', { ...state });
        return;
      }

      // Advance to next turn
      this.nextTurn();
    },

    /**
     * Advances to the next player. Increments round when wrapping.
     */
    nextTurn() {
      if (!state || state.status !== 'playing') {
        throw new Error('Cannot advance turn: game is not in playing state');
      }

      const prevPlayerIndex = state.currentPlayerIndex;
      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

      // If we wrapped around, increment the round
      if (state.currentPlayerIndex === 0) {
        state.currentRound++;

        // Check round limit
        if (state.maxRounds !== null && state.currentRound > state.maxRounds) {
          state.status = 'finished';
          state.updatedAt = Date.now();
          emit('turnEnd', { previousPlayerIndex: prevPlayerIndex });
          emit('stateChange', { ...state });
          emit('gameOver', { ...state });
          return;
        }
      }

      // Reset dice for new turn
      state.rollsThisTurn = 0;
      state.dice.held = new Array(mode.diceCount).fill(false);
      state.dice.values = new Array(mode.diceCount).fill(0);
      diceEngine.reset(mode.diceCount);
      state.updatedAt = Date.now();

      emit('turnEnd', { previousPlayerIndex: prevPlayerIndex });
      emit('stateChange', { ...state });
    },

    /**
     * Returns the current game state.
     * @returns {object|null}
     */
    getState() {
      return state ? { ...state } : null;
    },

    /**
     * Registers an event handler.
     * @param {string} event - One of: stateChange, roll, turnEnd, gameOver, playerDisconnected, playerReconnected
     * @param {Function} handler
     */
    on(event, handler) {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event).push(handler);
    },

    /**
     * Toggles the hold state of a die at the given index.
     * @param {number} index
     */
    toggleHold(index) {
      if (!state || state.status !== 'playing') return;
      if (index < 0 || index >= state.dice.count) return;
      if (state.rollsThisTurn === 0) return; // Can't hold before first roll

      state.dice.held[index] = !state.dice.held[index];
      diceEngine.toggleHold(index);
      state.updatedAt = Date.now();
      emit('stateChange', { ...state });
    },

    /**
     * Resets dice to a new count (for free-roll mode).
     * @param {number} count
     */
    resetDice(count) {
      if (!state || state.status !== 'playing') return;
      if (count < 1 || count > 6) return;
      diceEngine.reset(count);
      state.dice = {
        values: new Array(count).fill(0),
        held: new Array(count).fill(false),
        count,
      };
      state.rollsThisTurn = 0;
      state.updatedAt = Date.now();
      emit('stateChange', { ...state });
    },

    /**
     * Marks a player as disconnected.
     * @param {string} playerId
     */
    disconnectPlayer(playerId) {
      if (!state) return;
      const player = state.players.find((p) => p.id === playerId);
      if (player) {
        player.connectionStatus = 'disconnected';
        state.updatedAt = Date.now();
        emit('playerDisconnected', { playerId });
        emit('stateChange', { ...state });
      }
    },

    /**
     * Marks a player as reconnected.
     * @param {string} playerId
     */
    reconnectPlayer(playerId) {
      if (!state) return;
      const player = state.players.find((p) => p.id === playerId);
      if (player) {
        player.connectionStatus = 'connected';
        state.updatedAt = Date.now();
        emit('playerReconnected', { playerId, state: { ...state } });
        emit('stateChange', { ...state });
      }
    },
  };
}

// Unit-Tests für Offline-Game-Controller
// Feature: offline-multiplayer, Anforderungen: 4.2, 4.3, 5.3, 5.4, 6.3, 6.4
import { describe, it, expect, vi } from 'vitest';
import { createGameAction, createOfflineGameController } from '../js/multiplayer/offline-game-controller.js';

// --- Helpers ---

/**
 * Creates a mock peer with send, onMessage, and onConnectionChange.
 * Returns the mock and a way to simulate incoming messages.
 */
function createMockPeer() {
  const sentMessages = [];
  let messageHandler = null;
  let connectionChangeHandler = null;

  return {
    peer: {
      send(msg) {
        sentMessages.push(msg);
      },
      onMessage(handler) {
        messageHandler = handler;
      },
      onConnectionChange(handler) {
        connectionChangeHandler = handler;
      },
    },
    sentMessages,
    /** Simulate receiving a message from the remote peer */
    receiveMessage(msg) {
      if (messageHandler) messageHandler(msg);
    },
    /** Simulate a connection status change from the peer */
    triggerConnectionChange(status) {
      if (connectionChangeHandler) connectionChangeHandler(status);
    },
  };
}

/**
 * Creates a mock gameEngine that tracks calls and returns controllable state.
 */
function createMockGameEngine(initialState = null) {
  let state = initialState;
  const calls = { startGame: [], roll: [], toggleHold: [], selectScore: [] };
  const eventHandlers = new Map();

  return {
    engine: {
      startGame(modeId, players) {
        calls.startGame.push({ modeId, players });
        state = {
          gameId: 'test-game-1',
          modeId,
          status: 'playing',
          players: players.map((p, i) => ({
            id: p.id,
            name: p.name,
            connectionStatus: 'connected',
            isHost: i === 0,
          })),
          currentPlayerIndex: 0,
          currentRound: 1,
          maxRounds: 13,
          dice: { values: [0, 0, 0, 0, 0], held: [false, false, false, false, false], count: 5 },
          rollsThisTurn: 0,
          scores: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        return { ...state };
      },
      roll() {
        calls.roll.push({});
        state = { ...state, rollsThisTurn: state.rollsThisTurn + 1, updatedAt: Date.now() };
        return { values: [1, 2, 3, 4, 5], rolledIndices: [0, 1, 2, 3, 4] };
      },
      toggleHold(index) {
        calls.toggleHold.push({ index });
        const held = [...state.dice.held];
        held[index] = !held[index];
        state = { ...state, dice: { ...state.dice, held }, updatedAt: Date.now() };
      },
      selectScore(option) {
        calls.selectScore.push({ option });
        state = { ...state, updatedAt: Date.now() };
      },
      getState() {
        return state ? { ...state } : null;
      },
      on(event, handler) {
        if (!eventHandlers.has(event)) eventHandlers.set(event, []);
        eventHandlers.get(event).push(handler);
      },
    },
    calls,
    getState() {
      return state;
    },
    /** Directly set the engine state for test scenarios */
    setState(newState) {
      state = newState;
    },
    /** Emit an event on the engine */
    emit(event, data) {
      const handlers = eventHandlers.get(event);
      if (handlers) handlers.forEach((h) => h(data));
    },
  };
}

/**
 * Creates a standard two-player game state for testing.
 */
function createTestGameState(overrides = {}) {
  return {
    gameId: 'test-game-1',
    modeId: 'kniffel',
    status: 'playing',
    players: [
      { id: 'host-player', name: 'Host', connectionStatus: 'connected', isHost: true },
      { id: 'client-player', name: 'Client', connectionStatus: 'connected', isHost: false },
    ],
    currentPlayerIndex: 0,
    currentRound: 1,
    maxRounds: 13,
    dice: { values: [0, 0, 0, 0, 0], held: [false, false, false, false, false], count: 5 },
    rollsThisTurn: 0,
    scores: {},
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

// --- Tests ---

describe('Offline Game Controller — Unit Tests', () => {
  describe('Host sends initial GameState on game start (Req 4.2, 6.3)', () => {
    it('should send a start action with the initial GameState to the client', () => {
      const { peer, sentMessages } = createMockPeer();
      const { engine } = createMockGameEngine();

      const controller = createOfflineGameController({
        peer,
        gameEngine: engine,
        isHost: true,
        playerId: 'host-player',
      });

      const players = [
        { id: 'host-player', name: 'Host' },
        { id: 'client-player', name: 'Client' },
      ];

      const initialState = controller.startGame('kniffel', players);

      // Should have sent exactly one message
      expect(sentMessages.length).toBe(1);

      // The sent message should be a 'start' action
      const sentAction = sentMessages[0];
      expect(sentAction.type).toBe('start');
      expect(sentAction.playerId).toBe('host-player');
      expect(sentAction.timestamp).toBeGreaterThan(0);

      // The payload should contain the initial GameState
      expect(sentAction.payload).toBeDefined();
      expect(sentAction.payload.gameState).toBeDefined();
      expect(sentAction.payload.gameState.modeId).toBe('kniffel');
      expect(sentAction.payload.gameState.status).toBe('playing');
      expect(sentAction.payload.gameState.players).toHaveLength(2);

      // The returned state should match what was sent
      expect(initialState).toEqual(sentAction.payload.gameState);

      controller.destroy();
    });

    it('should emit stateChange with the initial GameState', () => {
      const { peer } = createMockPeer();
      const { engine } = createMockGameEngine();

      const controller = createOfflineGameController({
        peer,
        gameEngine: engine,
        isHost: true,
        playerId: 'host-player',
      });

      const stateChanges = [];
      controller.onStateChange((state) => stateChanges.push(state));

      controller.startGame('kniffel', [
        { id: 'host-player', name: 'Host' },
        { id: 'client-player', name: 'Client' },
      ]);

      expect(stateChanges.length).toBe(1);
      expect(stateChanges[0].status).toBe('playing');

      controller.destroy();
    });
  });

  describe('Client navigates to Game-Screen after receiving initial GameState (Req 6.4)', () => {
    it('should update local state when receiving a start action from host', () => {
      const { peer, receiveMessage } = createMockPeer();
      const { engine } = createMockGameEngine();

      const controller = createOfflineGameController({
        peer,
        gameEngine: engine,
        isHost: false,
        playerId: 'client-player',
      });

      // Initially no state
      expect(controller.getState()).toBeNull();

      // Simulate receiving the initial GameState from the host
      const gameState = createTestGameState();
      receiveMessage({
        type: 'start',
        playerId: 'host-player',
        timestamp: Date.now(),
        payload: { gameState },
      });

      // Client should now have the game state
      expect(controller.getState()).toEqual(gameState);

      controller.destroy();
    });

    it('should emit stateChange when receiving initial GameState', () => {
      const { peer, receiveMessage } = createMockPeer();
      const { engine } = createMockGameEngine();

      const controller = createOfflineGameController({
        peer,
        gameEngine: engine,
        isHost: false,
        playerId: 'client-player',
      });

      const stateChanges = [];
      controller.onStateChange((state) => stateChanges.push(state));

      const gameState = createTestGameState();
      receiveMessage({
        type: 'start',
        playerId: 'host-player',
        timestamp: Date.now(),
        payload: { gameState },
      });

      // stateChange should have been emitted with the game state
      expect(stateChanges.length).toBe(1);
      expect(stateChanges[0]).toEqual(gameState);

      controller.destroy();
    });
  });

  describe('Turn change is displayed on both devices (Req 5.3)', () => {
    it('host emits stateChange after processing a client action that changes turn', () => {
      const gameState = createTestGameState({
        currentPlayerIndex: 1, // Client's turn
        rollsThisTurn: 1,
      });
      const { peer, receiveMessage } = createMockPeer();
      const { engine } = createMockGameEngine(gameState);

      // After selectScore, simulate the engine advancing the turn
      engine.selectScore = (option) => {
        const s = engine.getState();
        engine.setState({
          ...s,
          currentPlayerIndex: 0, // Turn changes back to host
          rollsThisTurn: 0,
          updatedAt: Date.now(),
        });
      };
      // Re-assign getState to use the mock's internal state
      const mockEngine = createMockGameEngine(gameState);
      // Use a fresh approach with the real mock
      const { peer: peer2, sentMessages: sent2, receiveMessage: recv2 } = createMockPeer();
      let engineState = { ...gameState };
      const gameEngine2 = {
        getState() {
          return { ...engineState };
        },
        selectScore(option) {
          engineState = {
            ...engineState,
            currentPlayerIndex: 0,
            rollsThisTurn: 0,
            updatedAt: Date.now(),
          };
        },
        roll() {
          engineState = { ...engineState, rollsThisTurn: engineState.rollsThisTurn + 1, updatedAt: Date.now() };
        },
        toggleHold() {},
      };

      const controller = createOfflineGameController({
        peer: peer2,
        gameEngine: gameEngine2,
        isHost: true,
        playerId: 'host-player',
      });

      const stateChanges = [];
      controller.onStateChange((state) => stateChanges.push(state));

      // Client sends a score action (it's client's turn at index 1)
      recv2({
        type: 'score',
        playerId: 'client-player',
        timestamp: Date.now(),
        payload: { categoryId: 'ones', score: 3 },
      });

      // Host should have emitted stateChange with the updated turn
      expect(stateChanges.length).toBeGreaterThanOrEqual(1);
      const latestState = stateChanges[stateChanges.length - 1];
      expect(latestState.currentPlayerIndex).toBe(0); // Turn changed to host

      // Host should have sent the updated state to the client
      expect(sent2.length).toBeGreaterThanOrEqual(1);
      const syncAction = sent2[sent2.length - 1];
      expect(syncAction.type).toBe('sync');
      expect(syncAction.payload.gameState.currentPlayerIndex).toBe(0);

      controller.destroy();
    });

    it('client receives turn change via sync action', () => {
      const { peer, receiveMessage } = createMockPeer();
      const { engine } = createMockGameEngine();

      const controller = createOfflineGameController({
        peer,
        gameEngine: engine,
        isHost: false,
        playerId: 'client-player',
      });

      const stateChanges = [];
      controller.onStateChange((state) => stateChanges.push(state));

      // First sync: client's turn
      receiveMessage({
        type: 'sync',
        playerId: 'host-player',
        timestamp: Date.now(),
        payload: {
          gameState: createTestGameState({ currentPlayerIndex: 1 }),
        },
      });

      // Second sync: host's turn (turn changed)
      receiveMessage({
        type: 'sync',
        playerId: 'host-player',
        timestamp: Date.now(),
        payload: {
          gameState: createTestGameState({ currentPlayerIndex: 0 }),
        },
      });

      expect(stateChanges.length).toBe(2);
      expect(stateChanges[0].currentPlayerIndex).toBe(1);
      expect(stateChanges[1].currentPlayerIndex).toBe(0);

      controller.destroy();
    });
  });

  describe('Game end navigates to Result-Screen (Req 5.4)', () => {
    it('host emits gameOver when game state becomes finished', () => {
      const gameState = createTestGameState({
        currentPlayerIndex: 1,
        rollsThisTurn: 1,
      });

      const { peer, sentMessages, receiveMessage } = createMockPeer();
      let engineState = { ...gameState };
      const gameEngine = {
        getState() {
          return { ...engineState };
        },
        selectScore(option) {
          // Simulate game ending after this score
          engineState = {
            ...engineState,
            status: 'finished',
            updatedAt: Date.now(),
          };
        },
        roll() {},
        toggleHold() {},
      };

      const controller = createOfflineGameController({
        peer,
        gameEngine,
        isHost: true,
        playerId: 'host-player',
      });

      const gameOverStates = [];
      controller.onGameOver((state) => gameOverStates.push(state));

      // Client sends a score action that ends the game
      receiveMessage({
        type: 'score',
        playerId: 'client-player',
        timestamp: Date.now(),
        payload: { categoryId: 'kniffel', score: 50 },
      });

      // gameOver should have been emitted
      expect(gameOverStates.length).toBe(1);
      expect(gameOverStates[0].status).toBe('finished');

      // The sync message sent to client should also contain the finished state
      expect(sentMessages.length).toBeGreaterThanOrEqual(1);
      const lastSent = sentMessages[sentMessages.length - 1];
      expect(lastSent.payload.gameState.status).toBe('finished');

      controller.destroy();
    });

    it('client emits gameOver when receiving a finished GameState', () => {
      const { peer, receiveMessage } = createMockPeer();
      const { engine } = createMockGameEngine();

      const controller = createOfflineGameController({
        peer,
        gameEngine: engine,
        isHost: false,
        playerId: 'client-player',
      });

      const gameOverStates = [];
      controller.onGameOver((state) => gameOverStates.push(state));

      // Receive a gameOver action from host
      receiveMessage({
        type: 'gameOver',
        playerId: 'host-player',
        timestamp: Date.now(),
        payload: {
          gameState: createTestGameState({ status: 'finished' }),
        },
      });

      expect(gameOverStates.length).toBe(1);
      expect(gameOverStates[0].status).toBe('finished');

      controller.destroy();
    });

    it('client emits gameOver when receiving a sync with finished status', () => {
      const { peer, receiveMessage } = createMockPeer();
      const { engine } = createMockGameEngine();

      const controller = createOfflineGameController({
        peer,
        gameEngine: engine,
        isHost: false,
        playerId: 'client-player',
      });

      const gameOverStates = [];
      controller.onGameOver((state) => gameOverStates.push(state));

      receiveMessage({
        type: 'sync',
        playerId: 'host-player',
        timestamp: Date.now(),
        payload: {
          gameState: createTestGameState({ status: 'finished' }),
        },
      });

      expect(gameOverStates.length).toBe(1);
      expect(gameOverStates[0].status).toBe('finished');

      controller.destroy();
    });
  });

  describe('Host ignores Action when Client is not current player (Req 4.3)', () => {
    it('should ignore a roll action from a player who is not the current player', () => {
      // Host's turn (currentPlayerIndex: 0 = host-player)
      const gameState = createTestGameState({ currentPlayerIndex: 0 });

      const { peer, sentMessages, receiveMessage } = createMockPeer();
      let engineState = { ...gameState };
      let rollCalled = false;
      const gameEngine = {
        getState() {
          return { ...engineState };
        },
        roll() {
          rollCalled = true;
        },
        toggleHold() {},
        selectScore() {},
      };

      const controller = createOfflineGameController({
        peer,
        gameEngine,
        isHost: true,
        playerId: 'host-player',
      });

      // Client sends a roll action, but it's the host's turn
      receiveMessage({
        type: 'roll',
        playerId: 'client-player',
        timestamp: Date.now(),
        payload: {},
      });

      // The engine's roll should NOT have been called
      expect(rollCalled).toBe(false);

      // No sync message should have been sent
      expect(sentMessages.length).toBe(0);

      controller.destroy();
    });

    it('should ignore a hold action from a player who is not the current player', () => {
      const gameState = createTestGameState({ currentPlayerIndex: 0 });

      const { peer, sentMessages, receiveMessage } = createMockPeer();
      let holdCalled = false;
      const gameEngine = {
        getState() {
          return { ...gameState };
        },
        roll() {},
        toggleHold() {
          holdCalled = true;
        },
        selectScore() {},
      };

      const controller = createOfflineGameController({
        peer,
        gameEngine,
        isHost: true,
        playerId: 'host-player',
      });

      receiveMessage({
        type: 'hold',
        playerId: 'client-player',
        timestamp: Date.now(),
        payload: { dieIndex: 2 },
      });

      expect(holdCalled).toBe(false);
      expect(sentMessages.length).toBe(0);

      controller.destroy();
    });

    it('should ignore a score action from a player who is not the current player', () => {
      const gameState = createTestGameState({ currentPlayerIndex: 0 });

      const { peer, sentMessages, receiveMessage } = createMockPeer();
      let scoreCalled = false;
      const gameEngine = {
        getState() {
          return { ...gameState };
        },
        roll() {},
        toggleHold() {},
        selectScore() {
          scoreCalled = true;
        },
      };

      const controller = createOfflineGameController({
        peer,
        gameEngine,
        isHost: true,
        playerId: 'host-player',
      });

      receiveMessage({
        type: 'score',
        playerId: 'client-player',
        timestamp: Date.now(),
        payload: { categoryId: 'ones', score: 3 },
      });

      expect(scoreCalled).toBe(false);
      expect(sentMessages.length).toBe(0);

      controller.destroy();
    });

    it("should process action when it IS the current player's turn", () => {
      // Client's turn (currentPlayerIndex: 1 = client-player)
      const gameState = createTestGameState({ currentPlayerIndex: 1 });

      const { peer, sentMessages, receiveMessage } = createMockPeer();
      let engineState = { ...gameState };
      let rollCalled = false;
      const gameEngine = {
        getState() {
          return { ...engineState };
        },
        roll() {
          rollCalled = true;
          engineState = { ...engineState, rollsThisTurn: engineState.rollsThisTurn + 1, updatedAt: Date.now() };
        },
        toggleHold() {},
        selectScore() {},
      };

      const controller = createOfflineGameController({
        peer,
        gameEngine,
        isHost: true,
        playerId: 'host-player',
      });

      // Client sends a roll action and it IS their turn
      receiveMessage({
        type: 'roll',
        playerId: 'client-player',
        timestamp: Date.now(),
        payload: {},
      });

      // The engine's roll SHOULD have been called
      expect(rollCalled).toBe(true);

      // A sync message should have been sent
      expect(sentMessages.length).toBeGreaterThanOrEqual(1);

      controller.destroy();
    });
  });

  describe('Connection change handling (Req 7.1, 7.2, 7.3, 7.4)', () => {
    it('should emit "disconnected" when peer reports "reconnecting"', () => {
      const { peer, triggerConnectionChange } = createMockPeer();
      const { engine } = createMockGameEngine();

      const controller = createOfflineGameController({
        peer,
        gameEngine: engine,
        isHost: true,
        playerId: 'host-player',
      });

      const statusChanges = [];
      controller.onConnectionStatusChange((s) => statusChanges.push(s));

      triggerConnectionChange('reconnecting');

      expect(statusChanges).toEqual(['disconnected']);
      expect(controller.getConnectionStatus()).toBe('disconnected');

      controller.destroy();
    });

    it('should emit "failed" when peer reports "disconnected"', () => {
      const { peer, triggerConnectionChange } = createMockPeer();
      const { engine } = createMockGameEngine();

      const controller = createOfflineGameController({
        peer,
        gameEngine: engine,
        isHost: false,
        playerId: 'client-player',
      });

      const statusChanges = [];
      controller.onConnectionStatusChange((s) => statusChanges.push(s));

      triggerConnectionChange('disconnected');

      expect(statusChanges).toEqual(['failed']);
      expect(controller.getConnectionStatus()).toBe('failed');

      controller.destroy();
    });

    it('should preserve game state locally during disconnection (Req 7.3)', () => {
      const { peer, triggerConnectionChange, receiveMessage } = createMockPeer();
      const { engine } = createMockGameEngine();

      const controller = createOfflineGameController({
        peer,
        gameEngine: engine,
        isHost: false,
        playerId: 'client-player',
      });

      // Set up a game state on the client
      const gameState = createTestGameState();
      receiveMessage({
        type: 'start',
        playerId: 'host-player',
        timestamp: Date.now(),
        payload: { gameState },
      });

      expect(controller.getState()).toEqual(gameState);

      // Simulate disconnect
      triggerConnectionChange('reconnecting');

      // State should still be preserved
      expect(controller.getState()).toEqual(gameState);

      controller.destroy();
    });

    it('host should send GameState resync on reconnection (Req 7.4)', () => {
      const gameState = createTestGameState();
      const { peer, sentMessages, triggerConnectionChange } = createMockPeer();
      const gameEngine = {
        getState() {
          return { ...gameState };
        },
        startGame() {},
        roll() {},
        toggleHold() {},
        selectScore() {},
      };

      const controller = createOfflineGameController({
        peer,
        gameEngine,
        isHost: true,
        playerId: 'host-player',
      });

      // Simulate disconnect then reconnect
      triggerConnectionChange('reconnecting');
      sentMessages.length = 0; // Clear any messages

      triggerConnectionChange('connected');

      // Host should have sent a sync action with the current game state
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].type).toBe('sync');
      expect(sentMessages[0].payload.gameState).toEqual(gameState);

      controller.destroy();
    });

    it('client should NOT send resync on reconnection', () => {
      const { peer, sentMessages, triggerConnectionChange } = createMockPeer();
      const { engine } = createMockGameEngine();

      const controller = createOfflineGameController({
        peer,
        gameEngine: engine,
        isHost: false,
        playerId: 'client-player',
      });

      // Simulate disconnect then reconnect
      triggerConnectionChange('reconnecting');
      sentMessages.length = 0;

      triggerConnectionChange('connected');

      // Client should NOT send any resync
      expect(sentMessages.length).toBe(0);

      controller.destroy();
    });

    it('destroy should clean up connection status change handlers', () => {
      const { peer, triggerConnectionChange } = createMockPeer();
      const { engine } = createMockGameEngine();

      const controller = createOfflineGameController({
        peer,
        gameEngine: engine,
        isHost: true,
        playerId: 'host-player',
      });

      const statusChanges = [];
      controller.onConnectionStatusChange((s) => statusChanges.push(s));

      controller.destroy();

      // After destroy, handler should not be called
      triggerConnectionChange('reconnecting');
      expect(statusChanges.length).toBe(0);
    });
  });
});

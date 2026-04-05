// Feature: offline-multiplayer, Property 4 & 5
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createGameAction, createOfflineGameController } from '../js/multiplayer/offline-game-controller.js';

/**
 * **Validates: Requirements 4.5**
 *
 * Property 4: GameAction Metadaten-Invariante
 * For every GameAction created by the Offline-Game-Controller,
 * the action SHALL have a `timestamp` (number > 0) and a `playerId` (non-empty string).
 */

// --- Generators ---

/** Arbitrary non-empty playerId string */
const playerIdArb = fc.string({ minLength: 1 });

/** Arbitrary action type from the valid set */
const actionTypeArb = fc.constantFrom('roll', 'hold', 'score', 'sync', 'start', 'gameOver');

/** Arbitrary payload object */
const payloadArb = fc.oneof(
  fc.constant({}),
  fc.record({
    dieIndex: fc.nat({ max: 5 }),
  }),
  fc.record({
    categoryId: fc.string({ minLength: 1 }),
    score: fc.nat({ max: 50 }),
  }),
  fc.record({
    gameState: fc.record({
      status: fc.constantFrom('playing', 'finished'),
      currentPlayerIndex: fc.nat({ max: 1 }),
    }),
  })
);

describe('Property 4: GameAction Metadaten-Invariante', () => {
  it('every GameAction has timestamp > 0 and non-empty playerId', () => {
    fc.assert(
      fc.property(playerIdArb, actionTypeArb, payloadArb, (playerId, type, payload) => {
        const action = createGameAction(playerId, type, payload);

        // timestamp must be a number greater than 0
        expect(typeof action.timestamp).toBe('number');
        expect(action.timestamp).toBeGreaterThan(0);

        // playerId must be a non-empty string
        expect(typeof action.playerId).toBe('string');
        expect(action.playerId.length).toBeGreaterThan(0);

        // type must match the input type
        expect(action.type).toBe(type);

        // payload must match the input payload
        expect(action.payload).toEqual(payload);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: offline-multiplayer, Property 5: Host-Action-Verarbeitung

/**
 * **Validates: Requirements 4.3**
 *
 * Property 5: Host-Action-Verarbeitung
 * For every valid GameState and every valid GameAction received by the host
 * from the client, the host shall apply the action to the GameEngine and send
 * an updated GameState via DataChannel, whose updatedAt timestamp is greater
 * than or equal to the previous one.
 */

// --- Generators ---

/** Arbitrary player object */
const playerArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  name: fc.string({ minLength: 1, maxLength: 10 }),
  connectionStatus: fc.constant('connected'),
});

/** Arbitrary game state with two players and updatedAt */
const gameStateArb = fc.record({
  status: fc.constant('playing'),
  currentPlayerIndex: fc.constantFrom(0, 1),
  players: fc.tuple(playerArb, playerArb).map(([a, b]) => {
    // Ensure distinct player IDs
    if (a.id === b.id) b = { ...b, id: b.id + '_2' };
    return [a, b];
  }),
  currentRound: fc.integer({ min: 1, max: 10 }),
  rollsThisTurn: fc.integer({ min: 0, max: 3 }),
  dice: fc.record({
    values: fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 5, maxLength: 5 }),
    held: fc.array(fc.boolean(), { minLength: 5, maxLength: 5 }),
  }),
  updatedAt: fc.integer({ min: 1, max: 2000000000 }),
  scores: fc.constant({}),
});

/** Arbitrary action type that the host processes from a client */
const hostActionTypeArb = fc.constantFrom('roll', 'hold', 'score');

describe('Property 5: Host-Action-Verarbeitung', () => {
  it('host processes action and sends updated state with updatedAt >= previous', () => {
    fc.assert(
      fc.property(gameStateArb, hostActionTypeArb, (initialState, actionType) => {
        const previousUpdatedAt = initialState.updatedAt;

        // Track what the mock engine returns — starts with initial state
        let currentState = { ...initialState };

        // Mock gameEngine: getState returns current state, mutations bump updatedAt
        const gameEngine = {
          getState() {
            return { ...currentState };
          },
          roll() {
            currentState = { ...currentState, updatedAt: Math.max(currentState.updatedAt, Date.now()) };
          },
          toggleHold(index) {
            currentState = { ...currentState, updatedAt: Math.max(currentState.updatedAt, Date.now()) };
          },
          selectScore(payload) {
            currentState = { ...currentState, updatedAt: Math.max(currentState.updatedAt, Date.now()) };
          },
        };

        // Mock peer: captures sent messages
        const sentMessages = [];
        let messageHandler = null;
        const peer = {
          send(msg) {
            sentMessages.push(msg);
          },
          onMessage(handler) {
            messageHandler = handler;
          },
          onConnectionChange() {},
        };

        // Create host controller
        const controller = createOfflineGameController({
          peer,
          gameEngine,
          isHost: true,
          playerId: initialState.players[0].id,
        });

        // Build an action from the current player (the one at currentPlayerIndex)
        const currentPlayer = initialState.players[initialState.currentPlayerIndex];
        const actionPayload =
          actionType === 'hold'
            ? { dieIndex: 0 }
            : actionType === 'score'
              ? { categoryId: 'ones', score: 3 }
              : {};

        const action = {
          type: actionType,
          playerId: currentPlayer.id,
          timestamp: Date.now(),
          payload: actionPayload,
        };

        // Simulate receiving the action from the client via the peer message handler
        messageHandler(action);

        // Host should have sent an updated state via peer.send
        expect(sentMessages.length).toBeGreaterThanOrEqual(1);

        // The sent message is a sync action containing the updated gameState
        const sentAction = sentMessages[sentMessages.length - 1];
        expect(sentAction.type).toBe('sync');
        expect(sentAction.payload).toBeDefined();
        expect(sentAction.payload.gameState).toBeDefined();

        // updatedAt must be >= the previous state's updatedAt
        const newUpdatedAt = sentAction.payload.gameState.updatedAt;
        expect(newUpdatedAt).toBeGreaterThanOrEqual(previousUpdatedAt);

        // Cleanup
        controller.destroy();
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: offline-multiplayer, Property 6: Client-State-Ersetzung

/**
 * **Validates: Requirements 4.4**
 *
 * Property 6: Client-State-Ersetzung
 * For every GameState received by the client from the host, the client's local
 * state after processing shall exactly equal the received GameState.
 */

describe('Property 6: Client-State-Ersetzung', () => {
  it('client state after receiving sync equals the received state exactly', () => {
    fc.assert(
      fc.property(gameStateArb, (receivedState) => {
        // Mock peer: captures the onMessage handler
        let messageHandler = null;
        const peer = {
          send() {},
          onMessage(handler) {
            messageHandler = handler;
          },
          onConnectionChange() {},
        };

        // Mock gameEngine (client doesn't use it for state, but it's required)
        const gameEngine = {
          getState() {
            return null;
          },
        };

        // Create a client controller
        const controller = createOfflineGameController({
          peer,
          gameEngine,
          isHost: false,
          playerId: 'client-player',
        });

        // Simulate receiving a sync action from the host containing the game state
        const syncAction = {
          type: 'sync',
          playerId: 'host-player',
          timestamp: Date.now(),
          payload: { gameState: receivedState },
        };

        messageHandler(syncAction);

        // Client's local state must exactly equal the received state
        expect(controller.getState()).toEqual(receivedState);

        // Cleanup
        controller.destroy();
      }),
      { numRuns: 100 }
    );
  });

  it('client state after receiving start equals the received state exactly', () => {
    fc.assert(
      fc.property(gameStateArb, (receivedState) => {
        let messageHandler = null;
        const peer = {
          send() {},
          onMessage(handler) {
            messageHandler = handler;
          },
          onConnectionChange() {},
        };

        const gameEngine = {
          getState() {
            return null;
          },
        };

        const controller = createOfflineGameController({
          peer,
          gameEngine,
          isHost: false,
          playerId: 'client-player',
        });

        // Simulate receiving a start action from the host
        const startAction = {
          type: 'start',
          playerId: 'host-player',
          timestamp: Date.now(),
          payload: { gameState: receivedState },
        };

        messageHandler(startAction);

        // Client's local state must exactly equal the received state
        expect(controller.getState()).toEqual(receivedState);

        controller.destroy();
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: offline-multiplayer, Property 9: Spielzustand-Erhaltung bei Disconnect

/**
 * **Validates: Requirements 7.3**
 *
 * Property 9: Spielzustand-Erhaltung bei Verbindungsabbruch
 * For every GameState and every disconnect event, the local game state after
 * disconnect SHALL remain unchanged (deep equality with the state before disconnect).
 */

describe('Property 9: Spielzustand-Erhaltung bei Disconnect', () => {
  it('client state is unchanged after a reconnecting disconnect event', () => {
    fc.assert(
      fc.property(gameStateArb, (initialState) => {
        // Track the connection change handler registered by the controller
        let connectionChangeHandler = null;
        let messageHandler = null;

        const peer = {
          send() {},
          onMessage(handler) {
            messageHandler = handler;
          },
          onConnectionChange(handler) {
            connectionChangeHandler = handler;
          },
        };

        const gameEngine = {
          getState() {
            return null;
          },
        };

        // Create a client controller
        const controller = createOfflineGameController({
          peer,
          gameEngine,
          isHost: false,
          playerId: 'client-player',
        });

        // Set the client's local state via a sync message from the host
        messageHandler({
          type: 'sync',
          playerId: 'host-player',
          timestamp: Date.now(),
          payload: { gameState: initialState },
        });

        // Capture state before disconnect
        const stateBefore = controller.getState();

        // Simulate a disconnect via peer.onConnectionChange('reconnecting')
        connectionChangeHandler('reconnecting');

        // State after disconnect must deep-equal state before disconnect
        expect(controller.getState()).toEqual(stateBefore);

        controller.destroy();
      }),
      { numRuns: 100 }
    );
  });

  it('host state is unchanged after a reconnecting disconnect event', () => {
    fc.assert(
      fc.property(gameStateArb, (initialState) => {
        let connectionChangeHandler = null;

        // Host's state comes from gameEngine.getState()
        const gameEngine = {
          getState() {
            return initialState;
          },
          roll() {},
          toggleHold() {},
          selectScore() {},
        };

        const peer = {
          send() {},
          onMessage() {},
          onConnectionChange(handler) {
            connectionChangeHandler = handler;
          },
        };

        const controller = createOfflineGameController({
          peer,
          gameEngine,
          isHost: true,
          playerId: initialState.players[0].id,
        });

        // Capture state before disconnect
        const stateBefore = controller.getState();

        // Simulate a disconnect via peer.onConnectionChange('reconnecting')
        connectionChangeHandler('reconnecting');

        // Host state is sourced from gameEngine — must remain unchanged
        expect(controller.getState()).toEqual(stateBefore);

        controller.destroy();
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: offline-multiplayer, Property 10: Reconnection-State-Sync

/**
 * **Validates: Requirements 7.4**
 *
 * Property 10: Reconnection-State-Sync
 * For every GameState at the time of a disconnect, when the connection is
 * restored, the host shall send the current GameState to the client, and the
 * client shall adopt it as their local state.
 */

describe('Property 10: Reconnection-State-Sync', () => {
  it('host sends current GameState to client upon reconnection after disconnect', () => {
    fc.assert(
      fc.property(gameStateArb, (currentState) => {
        // Track sent messages from the host
        const sentMessages = [];
        let messageHandler = null;
        let connectionChangeHandler = null;

        const peer = {
          send(msg) {
            sentMessages.push(msg);
          },
          onMessage(handler) {
            messageHandler = handler;
          },
          onConnectionChange(handler) {
            connectionChangeHandler = handler;
          },
        };

        // Mock gameEngine that always returns the generated state
        const gameEngine = {
          getState() {
            return currentState;
          },
          roll() {},
          toggleHold() {},
          selectScore() {},
        };

        // Create host controller
        const controller = createOfflineGameController({
          peer,
          gameEngine,
          isHost: true,
          playerId: currentState.players[0].id,
        });

        // Clear any messages sent during construction
        sentMessages.length = 0;

        // Step 1: Simulate disconnect
        connectionChangeHandler('reconnecting');

        // No sync should be sent on disconnect
        expect(sentMessages.length).toBe(0);

        // Step 2: Simulate reconnect
        connectionChangeHandler('connected');

        // Host must have sent a sync action with the current game state
        expect(sentMessages.length).toBe(1);

        const sentAction = sentMessages[0];
        expect(sentAction.type).toBe('sync');
        expect(sentAction.payload).toBeDefined();
        expect(sentAction.payload.gameState).toBeDefined();

        // The sent game state must match the gameEngine's current state
        expect(sentAction.payload.gameState).toEqual(currentState);

        controller.destroy();
      }),
      { numRuns: 100 }
    );
  });

  it('host sends resync after failed status followed by reconnection', () => {
    fc.assert(
      fc.property(gameStateArb, (currentState) => {
        const sentMessages = [];
        let connectionChangeHandler = null;

        const peer = {
          send(msg) {
            sentMessages.push(msg);
          },
          onMessage() {},
          onConnectionChange(handler) {
            connectionChangeHandler = handler;
          },
        };

        const gameEngine = {
          getState() {
            return currentState;
          },
          roll() {},
          toggleHold() {},
          selectScore() {},
        };

        const controller = createOfflineGameController({
          peer,
          gameEngine,
          isHost: true,
          playerId: currentState.players[0].id,
        });

        sentMessages.length = 0;

        // Simulate a 'disconnected' peer status (maps to 'failed' in controller)
        connectionChangeHandler('disconnected');
        expect(sentMessages.length).toBe(0);

        // Simulate reconnection
        connectionChangeHandler('connected');

        // Host must send resync
        expect(sentMessages.length).toBe(1);
        expect(sentMessages[0].type).toBe('sync');
        expect(sentMessages[0].payload.gameState).toEqual(currentState);

        controller.destroy();
      }),
      { numRuns: 100 }
    );
  });

  it('client does NOT send state on reconnection (only host does)', () => {
    fc.assert(
      fc.property(gameStateArb, (initialState) => {
        const sentMessages = [];
        let messageHandler = null;
        let connectionChangeHandler = null;

        const peer = {
          send(msg) {
            sentMessages.push(msg);
          },
          onMessage(handler) {
            messageHandler = handler;
          },
          onConnectionChange(handler) {
            connectionChangeHandler = handler;
          },
        };

        const gameEngine = {
          getState() {
            return null;
          },
        };

        // Create client controller
        const controller = createOfflineGameController({
          peer,
          gameEngine,
          isHost: false,
          playerId: 'client-player',
        });

        // Set client state via sync
        messageHandler({
          type: 'sync',
          playerId: 'host-player',
          timestamp: Date.now(),
          payload: { gameState: initialState },
        });

        sentMessages.length = 0;

        // Simulate disconnect + reconnect on client
        connectionChangeHandler('reconnecting');
        connectionChangeHandler('connected');

        // Client must NOT send any sync messages — only the host does
        const syncMessages = sentMessages.filter((m) => m.type === 'sync');
        expect(syncMessages.length).toBe(0);

        controller.destroy();
      }),
      { numRuns: 100 }
    );
  });
});

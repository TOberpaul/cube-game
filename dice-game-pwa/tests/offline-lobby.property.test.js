// Feature: offline-multiplayer, Property 8: Start-Button-Zustand
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * **Validates: Requirements 6.1, 6.2**
 *
 * Property 8: Start-Button-Zustand
 * For any number of connected players in the lobby state, the "Spiel starten" button
 * shall be enabled exactly when exactly two players have connectionStatus === 'connected'.
 */

// --- Pure logic under test ---

/**
 * Determines whether the "Spiel starten" (Start Game) button should be enabled.
 * Returns true iff exactly 2 players have connectionStatus === 'connected'.
 * @param {Array<{ id: string, connectionStatus: string }>} players
 * @returns {boolean}
 */
export function shouldStartButtonBeEnabled(players) {
  const connectedCount = players.filter(
    (p) => p.connectionStatus === 'connected'
  ).length;
  return connectedCount === 2;
}

// --- Generators ---

/** Arbitrary connection status */
const connectionStatusArb = fc.constantFrom('connected', 'disconnected', 'connecting');

/** Arbitrary player with random id and connection status */
const playerArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  connectionStatus: connectionStatusArb,
  isHost: fc.boolean(),
});

/** Arbitrary lobby player list with 0-2 players */
const lobbyPlayersArb = fc.array(playerArb, { minLength: 0, maxLength: 2 });

// --- Property Test ---

describe('Property 8: Start-Button-Zustand', () => {
  it('start button is enabled exactly when exactly 2 players have connectionStatus "connected"', () => {
    fc.assert(
      fc.property(lobbyPlayersArb, (players) => {
        const result = shouldStartButtonBeEnabled(players);

        const connectedCount = players.filter(
          (p) => p.connectionStatus === 'connected'
        ).length;

        if (connectedCount === 2) {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
});


// Feature: offline-multiplayer, Property 7: Zugbasierte Steuerungsaktivierung
import { createOfflineGameController } from '../js/multiplayer/offline-game-controller.js';

/**
 * **Validates: Requirements 5.1, 5.2**
 *
 * Property 7: Zugbasierte Steuerungsaktivierung
 * For every GameState with two players and a currentPlayerIndex, the controls
 * (roll, hold) shall be enabled on the player's device exactly when
 * currentPlayerIndex corresponds to the local player.
 */

// --- Generators ---

/** Arbitrary player id (non-empty) */
const playerIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0);

/** Arbitrary currentPlayerIndex (0 or 1) */
const currentPlayerIndexArb = fc.constantFrom(0, 1);

/**
 * Generates a game state with 2 players, a currentPlayerIndex, and a localPlayerIndex
 * indicating which of the two players is the "local" player.
 */
const turnScenarioArb = fc.record({
  player0Id: playerIdArb,
  player1Id: playerIdArb,
  currentPlayerIndex: currentPlayerIndexArb,
  localPlayerIndex: currentPlayerIndexArb, // which player is local (0 or 1)
}).filter((s) => s.player0Id !== s.player1Id); // ensure distinct player IDs

// --- Helpers ---

function createMockPeer() {
  let messageHandler = null;
  return {
    send: () => {},
    onMessage: (handler) => {
      messageHandler = handler;
    },
    onConnectionChange: () => {},
    /** Simulate receiving a message from the remote peer */
    simulateMessage(msg) {
      if (messageHandler) messageHandler(msg);
    },
  };
}

function createMockGameEngine() {
  return {
    getState: () => null,
    startGame: () => ({}),
    roll: () => {},
    toggleHold: () => {},
    selectScore: () => {},
  };
}

// --- Property Test ---

describe('Property 7: Zugbasierte Steuerungsaktivierung', () => {
  it('isMyTurn() returns true exactly when currentPlayerIndex corresponds to the local player', () => {
    fc.assert(
      fc.property(turnScenarioArb, ({ player0Id, player1Id, currentPlayerIndex, localPlayerIndex }) => {
        const players = [
          { id: player0Id, name: 'Player 0' },
          { id: player1Id, name: 'Player 1' },
        ];
        const localPlayerId = localPlayerIndex === 0 ? player0Id : player1Id;

        const mockPeer = createMockPeer();
        const mockGameEngine = createMockGameEngine();

        // Create a client controller (uses localState set via sync messages)
        const controller = createOfflineGameController({
          peer: mockPeer,
          gameEngine: mockGameEngine,
          isHost: false,
          playerId: localPlayerId,
        });

        // Simulate receiving a game state from the host via sync action
        const gameState = {
          players,
          currentPlayerIndex,
          status: 'playing',
          updatedAt: Date.now(),
        };

        mockPeer.simulateMessage({
          type: 'sync',
          playerId: 'host',
          timestamp: Date.now(),
          payload: { gameState },
        });

        const result = controller.isMyTurn();
        const expected = currentPlayerIndex === localPlayerIndex;

        expect(result).toBe(expected);

        controller.destroy();
      }),
      { numRuns: 100 }
    );
  });
});

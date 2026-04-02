// Feature: dice-game-pwa, Property 8: Spieler-Reconnect stellt Zustand wieder her
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createGameEngine } from '../js/game/game-engine.js';
import { createGameModeRegistry } from '../js/game/game-mode-registry.js';
import { registerFreeRoll } from '../js/game/modes/free-roll.js';

/**
 * **Validates: Requirements 7.5**
 *
 * Property 8: Spieler-Reconnect stellt Zustand wieder her
 * For every game state with a disconnected player: after reconnect,
 * status becomes `connected`, player receives full game state.
 */

// Arbitrary for player definitions (2-8 players with unique IDs)
const playersArb = fc
  .integer({ min: 2, max: 8 })
  .chain((count) =>
    fc.array(
      fc.record({
        id: fc.uuid(),
        name: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
      }),
      { minLength: count, maxLength: count }
    )
  )
  .filter((players) => {
    const ids = new Set(players.map((p) => p.id));
    return ids.size === players.length;
  });

describe('Property 8: Spieler-Reconnect stellt Zustand wieder her', () => {
  it('reconnecting a disconnected player sets connectionStatus to connected and emits full game state', () => {
    fc.assert(
      fc.property(playersArb, (players) => {
        // Set up registry with free-roll mode
        const registry = createGameModeRegistry();
        registerFreeRoll(registry);

        const engine = createGameEngine(registry);
        engine.startGame('free-roll', players);

        // Pick a random player to disconnect then reconnect
        const playerIndex = Math.floor(Math.random() * players.length);
        const playerId = players[playerIndex].id;

        // Disconnect the player first
        engine.disconnectPlayer(playerId);

        // Verify player is disconnected before reconnect
        const stateBeforeReconnect = engine.getState();
        const disconnectedPlayer = stateBeforeReconnect.players.find((p) => p.id === playerId);
        expect(disconnectedPlayer.connectionStatus).toBe('disconnected');

        // Track playerReconnected event
        let reconnectEventData = null;
        engine.on('playerReconnected', (data) => {
          reconnectEventData = data;
        });

        // Reconnect the player
        engine.reconnectPlayer(playerId);

        // Assert: player's connectionStatus is 'connected'
        const stateAfterReconnect = engine.getState();
        const reconnectedPlayer = stateAfterReconnect.players.find((p) => p.id === playerId);
        expect(reconnectedPlayer.connectionStatus).toBe('connected');

        // Assert: playerReconnected event was emitted with correct playerId
        expect(reconnectEventData).not.toBeNull();
        expect(reconnectEventData.playerId).toBe(playerId);

        // Assert: event data includes the full game state
        expect(reconnectEventData.state).toBeDefined();
        expect(reconnectEventData.state.gameId).toBe(stateAfterReconnect.gameId);
        expect(reconnectEventData.state.modeId).toBe(stateAfterReconnect.modeId);
        expect(reconnectEventData.state.status).toBe(stateAfterReconnect.status);
        expect(reconnectEventData.state.players).toBeDefined();
        expect(reconnectEventData.state.players.length).toBe(players.length);
        expect(reconnectEventData.state.scores).toBeDefined();
        expect(reconnectEventData.state.currentPlayerIndex).toBeDefined();
        expect(reconnectEventData.state.currentRound).toBeDefined();
        expect(reconnectEventData.state.dice).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});

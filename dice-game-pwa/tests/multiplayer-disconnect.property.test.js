// Feature: dice-game-pwa, Property 7: Spieler-Disconnect setzt Status
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createGameEngine } from '../js/game/game-engine.js';
import { createGameModeRegistry } from '../js/game/game-mode-registry.js';
import { registerFreeRoll } from '../js/game/modes/free-roll.js';

/**
 * **Validates: Requirements 7.4, 8.5**
 *
 * Property 7: Spieler-Disconnect setzt Status
 * For every game state and connected player: on disconnect,
 * `connectionStatus` is set to `disconnected`, game stays `playing`.
 */

// Arbitrary for a player definition (2-8 players)
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
    // Ensure unique IDs
    const ids = new Set(players.map((p) => p.id));
    return ids.size === players.length;
  });

describe('Property 7: Spieler-Disconnect setzt Status', () => {
  it('disconnecting a connected player sets connectionStatus to disconnected and game stays playing', () => {
    fc.assert(
      fc.property(playersArb, (players) => {
        // Set up registry with free-roll mode
        const registry = createGameModeRegistry();
        registerFreeRoll(registry);

        const engine = createGameEngine(registry);
        engine.startGame('free-roll', players);

        // Pick a random connected player index
        const playerIndex = Math.floor(Math.random() * players.length);
        const playerId = players[playerIndex].id;

        // Track playerDisconnected event
        let emittedPlayerId = null;
        engine.on('playerDisconnected', (data) => {
          emittedPlayerId = data.playerId;
        });

        // Disconnect the player
        engine.disconnectPlayer(playerId);

        // Assert: player's connectionStatus is 'disconnected'
        const state = engine.getState();
        const disconnectedPlayer = state.players.find((p) => p.id === playerId);
        expect(disconnectedPlayer.connectionStatus).toBe('disconnected');

        // Assert: game status is still 'playing'
        expect(state.status).toBe('playing');

        // Assert: playerDisconnected event was emitted with correct playerId
        expect(emittedPlayerId).toBe(playerId);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: dice-game-pwa, Property 3: Spielmodus-Registry Round-Trip
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createGameModeRegistry } from '../js/game/game-mode-registry.js';

/**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 *
 * Property 3: For every valid GameModeConfig:
 * - After register(), get(id) returns a config with matching id, name, diceCount, maxPlayers
 * - getAll() contains a config with matching id
 */

// Arbitrary for valid GameModeConfig objects
const gameModeConfigArb = fc
  .record({
    id: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
    name: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
    diceCount: fc.integer({ min: 1, max: 6 }),
    maxPlayers: fc.integer({ min: 1, max: 8 }),
    scoring: fc.record({
      calculateOptions: fc.constant(() => []),
      applyScore: fc.constant((o, s) => s),
      isGameOver: fc.constant(() => false),
      getFinalScores: fc.constant(() => []),
    }),
    maxRounds: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 100 })),
    rollsPerTurn: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 10 })),
    categories: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 5 }),
  })
  .map((cfg) => ({
    ...cfg,
    // Ensure scoring is a plain object (not with fc.constant wrappers)
    scoring: {
      calculateOptions: cfg.scoring.calculateOptions,
      applyScore: cfg.scoring.applyScore,
      isGameOver: cfg.scoring.isGameOver,
      getFinalScores: cfg.scoring.getFinalScores,
    },
  }));

describe('Property 3: Spielmodus-Registry Round-Trip', () => {
  it('after register(), get(id) returns matching config and getAll() contains it', () => {
    fc.assert(
      fc.property(gameModeConfigArb, (config) => {
        const registry = createGameModeRegistry();

        registry.register(config);

        // get(id) must return a config with matching fields
        const retrieved = registry.get(config.id);
        expect(retrieved).toBeDefined();
        expect(retrieved.id).toBe(config.id);
        expect(retrieved.name).toBe(config.name);
        expect(retrieved.diceCount).toBe(config.diceCount);
        expect(retrieved.maxPlayers).toBe(config.maxPlayers);

        // getAll() must contain a config with matching id
        const all = registry.getAll();
        const found = all.find((m) => m.id === config.id);
        expect(found).toBeDefined();
        expect(found.id).toBe(config.id);
      }),
      { numRuns: 100 }
    );
  });
});

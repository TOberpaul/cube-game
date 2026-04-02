// Feature: dice-game-pwa, Property 1: Würfelwurf-Gültigkeit und Halte-Invarianz
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createDiceEngine } from '../js/dice/dice-engine.js';

/**
 * **Validates: Requirements 4.1, 4.2, 4.4**
 *
 * Property 1: For arbitrary dice counts (1–6) and hold combinations:
 * - All values are in [1, 6]
 * - Held dice values are unchanged from the previous roll
 * - Only non-held dice are re-rolled
 * - rolledIndices contains exactly the non-held indices
 */

describe('Property 1: Würfelwurf-Gültigkeit und Halte-Invarianz', () => {
  it('all values in [1,6], held dice unchanged, only non-held dice re-rolled', () => {
    // Generate a random dice count (1–6) and a random subset of valid indices as held
    const diceCountArb = fc.integer({ min: 1, max: 6 });

    const countAndHeldArb = diceCountArb.chain((count) => {
      // Generate a random subset of indices [0, count-1] to hold
      const indicesArb = fc.subarray(
        Array.from({ length: count }, (_, i) => i),
        { minLength: 0, maxLength: count }
      );
      return indicesArb.map((heldArray) => ({ count, heldArray }));
    });

    fc.assert(
      fc.property(countAndHeldArb, ({ count, heldArray }) => {
        const engine = createDiceEngine({ useCrypto: false });
        const heldSet = new Set(heldArray);

        // First roll to establish initial values (no held dice)
        const firstRoll = engine.roll(count, new Set());

        // Second roll with held indices
        const secondRoll = engine.roll(count, heldSet);

        // 1) All values must be in [1, 6]
        for (const value of secondRoll.values) {
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThanOrEqual(6);
        }

        // 2) Held dice values must be unchanged from the first roll
        for (const idx of heldArray) {
          expect(secondRoll.values[idx]).toBe(firstRoll.values[idx]);
        }

        // 3) rolledIndices contains exactly the non-held indices
        const expectedRolled = [];
        for (let i = 0; i < count; i++) {
          if (!heldSet.has(i)) {
            expectedRolled.push(i);
          }
        }
        expect(secondRoll.rolledIndices).toEqual(expectedRolled);

        // 4) rolledIndices does NOT contain any held indices
        for (const idx of heldArray) {
          expect(secondRoll.rolledIndices).not.toContain(idx);
        }
      }),
      { numRuns: 100 }
    );
  });
});

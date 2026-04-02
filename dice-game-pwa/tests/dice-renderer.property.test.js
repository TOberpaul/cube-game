// Feature: dice-game-pwa, Property 2: Würfel-Rendering erzeugt korrekte Anzahl
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

// Mock motion.dev before importing dice-renderer (it imports motion-system which imports motion)
const mockFinished = Promise.resolve();
const mockAnimation = { finished: mockFinished };
vi.mock('motion', () => ({
  animate: vi.fn(() => mockAnimation),
}));

import { createDiceRenderer } from '../js/dice/dice-renderer.js';

/**
 * **Validates: Requirements 3.4**
 *
 * Property 2: Würfel-Rendering erzeugt korrekte Anzahl
 * For every valid count n (1–6): Renderer creates exactly n dice DOM elements.
 * - The container has exactly 1 `.dice-container` child
 * - The `.dice-container` has exactly n `.die` children
 * - Each `.die` has exactly 6 `.die-face` children
 */
describe('Property 2: Würfel-Rendering erzeugt korrekte Anzahl', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('for every valid count n (1–6), renderer creates exactly n dice with 6 faces each', () => {
    const countArb = fc.integer({ min: 1, max: 6 });

    fc.assert(
      fc.property(countArb, (n) => {
        const renderer = createDiceRenderer();
        renderer.create(container, n);

        // Container has exactly 1 .dice-container child
        const diceContainers = container.querySelectorAll(':scope > .dice-container');
        expect(diceContainers.length).toBe(1);

        // .dice-container has exactly n .die children
        const diceContainer = diceContainers[0];
        const dice = diceContainer.querySelectorAll(':scope > .die');
        expect(dice.length).toBe(n);

        // Each .die has exactly 6 .die-face children
        dice.forEach((die) => {
          const faces = die.querySelectorAll(':scope > .die-face');
          expect(faces.length).toBe(6);
        });

        // Clean up
        renderer.destroy();
      }),
      { numRuns: 100 },
    );
  });
});

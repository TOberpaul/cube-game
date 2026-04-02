// Feature: dice-game-pwa, Property 11: ARIA-Live-Region enthält Würfelergebnis
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { announceDiceResult } from '../js/dice/dice-announcer.js';
import { loadMessages } from '../js/i18n.js';

/**
 * **Validates: Requirements 10.3**
 *
 * Property 11: For every dice result (array of values 1–6),
 * the ARIA live region contains a non-empty text that includes
 * every individual dice value as a string.
 */

describe('Property 11: ARIA-Live-Region enthält Würfelergebnis', () => {
  beforeEach(() => {
    // Set up the DOM with a #dice-announcer element
    document.body.innerHTML = '<div id="dice-announcer" aria-live="assertive"></div>';

    // Load i18n messages with the dice.result template
    loadMessages({ 'dice.result': 'Würfelergebnis: {values}' });
  });

  it('ARIA live region contains text with all dice values for every dice result', () => {
    // Generate random arrays of 1–6 dice, each value 1–6
    const diceValuesArb = fc.array(fc.integer({ min: 1, max: 6 }), {
      minLength: 1,
      maxLength: 6,
    });

    fc.assert(
      fc.property(diceValuesArb, (values) => {
        // Call the announcer
        announceDiceResult(values);

        const announcer = document.getElementById('dice-announcer');
        const text = announcer.textContent;

        // Text must be non-empty
        expect(text).toBeTruthy();
        expect(text.length).toBeGreaterThan(0);

        // Text must contain each individual dice value
        for (const value of values) {
          expect(text).toContain(String(value));
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: dice-game-pwa, Property 12: Kniffel-Bewertung berechnet korrekte Punktzahlen
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateCategoryScore } from '../js/game/modes/kniffel.js';

/**
 * **Validates: Requirements 5.5**
 *
 * Property 12: For every valid 5-dice combination (values 1–6) and every category,
 * calculateCategoryScore returns the correct score per official Kniffel rules.
 */

// --- Helpers to compute expected scores independently ---

function countValues(dice) {
  const counts = new Map();
  for (const v of dice) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return counts;
}

function sumAll(dice) {
  return dice.reduce((a, b) => a + b, 0);
}

function maxCount(dice) {
  return Math.max(...countValues(dice).values());
}

function hasConsecutive(dice, n) {
  const sorted = [...new Set(dice)].sort((a, b) => a - b);
  if (sorted.length < n) return false;
  let consecutive = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      consecutive++;
      if (consecutive >= n) return true;
    } else {
      consecutive = 1;
    }
  }
  return false;
}

// Arbitrary: array of exactly 5 dice values, each 1–6
const diceArb = fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 5, maxLength: 5 });

describe('Property 12: Kniffel-Bewertung berechnet korrekte Punktzahlen', () => {
  // 1. Upper block (ones through sixes): score = count_of_value * value
  it('upper block categories score count_of_value * value', () => {
    const upperCategories = [
      { category: 'ones', value: 1 },
      { category: 'twos', value: 2 },
      { category: 'threes', value: 3 },
      { category: 'fours', value: 4 },
      { category: 'fives', value: 5 },
      { category: 'sixes', value: 6 },
    ];

    for (const { category, value } of upperCategories) {
      fc.assert(
        fc.property(diceArb, (dice) => {
          const counts = countValues(dice);
          const expected = (counts.get(value) || 0) * value;
          expect(calculateCategoryScore(category, dice)).toBe(expected);
        }),
        { numRuns: 100 }
      );
    }
  });

  // 2. Three of a kind: if max count >= 3, score = sum; else 0
  it('threeOfAKind scores sum of all dice when max count >= 3, else 0', () => {
    fc.assert(
      fc.property(diceArb, (dice) => {
        const expected = maxCount(dice) >= 3 ? sumAll(dice) : 0;
        expect(calculateCategoryScore('threeOfAKind', dice)).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  // 3. Four of a kind: if max count >= 4, score = sum; else 0
  it('fourOfAKind scores sum of all dice when max count >= 4, else 0', () => {
    fc.assert(
      fc.property(diceArb, (dice) => {
        const expected = maxCount(dice) >= 4 ? sumAll(dice) : 0;
        expect(calculateCategoryScore('fourOfAKind', dice)).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  // 4. Full House: exactly 2 distinct values with counts 2 and 3 → 25; else 0
  it('fullHouse scores 25 when exactly 2 distinct values with counts 2 and 3, else 0', () => {
    fc.assert(
      fc.property(diceArb, (dice) => {
        const counts = countValues(dice);
        const vals = [...counts.values()].sort();
        const isFullHouse = vals.length === 2 && vals[0] === 2 && vals[1] === 3;
        const expected = isFullHouse ? 25 : 0;
        expect(calculateCategoryScore('fullHouse', dice)).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  // 5. Small Straight: 4+ consecutive values → 30; else 0
  it('smallStraight scores 30 when 4+ consecutive values exist, else 0', () => {
    fc.assert(
      fc.property(diceArb, (dice) => {
        const expected = hasConsecutive(dice, 4) ? 30 : 0;
        expect(calculateCategoryScore('smallStraight', dice)).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  // 6. Large Straight: 5 consecutive values → 40; else 0
  it('largeStraight scores 40 when 5 consecutive values exist, else 0', () => {
    fc.assert(
      fc.property(diceArb, (dice) => {
        const expected = hasConsecutive(dice, 5) ? 40 : 0;
        expect(calculateCategoryScore('largeStraight', dice)).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  // 7. Kniffel: all 5 same → 50; else 0
  it('kniffel scores 50 when all 5 dice are the same, else 0', () => {
    fc.assert(
      fc.property(diceArb, (dice) => {
        const expected = maxCount(dice) === 5 ? 50 : 0;
        expect(calculateCategoryScore('kniffel', dice)).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  // 8. Chance: always sum of all dice
  it('chance always scores sum of all dice', () => {
    fc.assert(
      fc.property(diceArb, (dice) => {
        expect(calculateCategoryScore('chance', dice)).toBe(sumAll(dice));
      }),
      { numRuns: 100 }
    );
  });
});

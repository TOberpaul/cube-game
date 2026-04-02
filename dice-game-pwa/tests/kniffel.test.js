import { describe, it, expect } from 'vitest';
import {
  kniffelMode,
  registerKniffel,
  calculateCategoryScore,
  createEmptyScoreSheet,
} from '../js/game/modes/kniffel.js';
import { createGameModeRegistry } from '../js/game/game-mode-registry.js';

// --- Helper to build game state ---
function makeState(players, scores = {}) {
  return {
    players: players.map((name, i) => ({ id: `p${i + 1}`, name })),
    currentPlayerIndex: 0,
    scores,
  };
}

function emptySheet(playerId) {
  return createEmptyScoreSheet(playerId);
}

describe('Kniffel Mode', () => {
  it('has correct config values', () => {
    expect(kniffelMode.id).toBe('kniffel');
    expect(kniffelMode.name).toBe('mode.kniffel');
    expect(kniffelMode.diceCount).toBe(5);
    expect(kniffelMode.maxPlayers).toBe(8);
    expect(kniffelMode.maxRounds).toBe(13);
    expect(kniffelMode.rollsPerTurn).toBe(3);
    expect(kniffelMode.scoring).toBeDefined();
    expect(kniffelMode.categories).toHaveLength(13);
  });

  describe('registerKniffel', () => {
    it('registers the mode in the registry', () => {
      const registry = createGameModeRegistry();
      registerKniffel(registry);
      const mode = registry.get('kniffel');
      expect(mode).toBeDefined();
      expect(mode.id).toBe('kniffel');
    });
  });

  describe('calculateCategoryScore', () => {
    // Upper block
    it('ones: sums only 1s', () => {
      expect(calculateCategoryScore('ones', [1, 1, 3, 4, 5])).toBe(2);
      expect(calculateCategoryScore('ones', [2, 3, 4, 5, 6])).toBe(0);
    });

    it('twos: sums only 2s', () => {
      expect(calculateCategoryScore('twos', [2, 2, 2, 4, 5])).toBe(6);
    });

    it('threes: sums only 3s', () => {
      expect(calculateCategoryScore('threes', [3, 3, 3, 3, 5])).toBe(12);
    });

    it('fours: sums only 4s', () => {
      expect(calculateCategoryScore('fours', [4, 4, 1, 2, 3])).toBe(8);
    });

    it('fives: sums only 5s', () => {
      expect(calculateCategoryScore('fives', [5, 5, 5, 5, 5])).toBe(25);
    });

    it('sixes: sums only 6s', () => {
      expect(calculateCategoryScore('sixes', [6, 6, 1, 2, 3])).toBe(12);
    });

    // Lower block
    it('threeOfAKind: sum of all dice if 3+ match', () => {
      expect(calculateCategoryScore('threeOfAKind', [3, 3, 3, 4, 5])).toBe(18);
      expect(calculateCategoryScore('threeOfAKind', [1, 2, 3, 4, 5])).toBe(0);
    });

    it('fourOfAKind: sum of all dice if 4+ match', () => {
      expect(calculateCategoryScore('fourOfAKind', [2, 2, 2, 2, 5])).toBe(13);
      expect(calculateCategoryScore('fourOfAKind', [3, 3, 3, 4, 5])).toBe(0);
    });

    it('fullHouse: 25 if 3 of one + 2 of another', () => {
      expect(calculateCategoryScore('fullHouse', [2, 2, 3, 3, 3])).toBe(25);
      expect(calculateCategoryScore('fullHouse', [1, 2, 3, 4, 5])).toBe(0);
      expect(calculateCategoryScore('fullHouse', [3, 3, 3, 3, 3])).toBe(0); // 5 of a kind is NOT full house
    });

    it('smallStraight: 30 if 4 consecutive', () => {
      expect(calculateCategoryScore('smallStraight', [1, 2, 3, 4, 6])).toBe(30);
      expect(calculateCategoryScore('smallStraight', [2, 3, 4, 5, 1])).toBe(30);
      expect(calculateCategoryScore('smallStraight', [3, 4, 5, 6, 1])).toBe(30);
      expect(calculateCategoryScore('smallStraight', [1, 2, 4, 5, 6])).toBe(0);
    });

    it('largeStraight: 40 if 5 consecutive', () => {
      expect(calculateCategoryScore('largeStraight', [1, 2, 3, 4, 5])).toBe(40);
      expect(calculateCategoryScore('largeStraight', [2, 3, 4, 5, 6])).toBe(40);
      expect(calculateCategoryScore('largeStraight', [1, 2, 3, 4, 6])).toBe(0);
    });

    it('kniffel: 50 if all 5 dice same', () => {
      expect(calculateCategoryScore('kniffel', [1, 1, 1, 1, 1])).toBe(50);
      expect(calculateCategoryScore('kniffel', [6, 6, 6, 6, 6])).toBe(50);
      expect(calculateCategoryScore('kniffel', [1, 1, 1, 1, 2])).toBe(0);
    });

    it('chance: sum of all dice always', () => {
      expect(calculateCategoryScore('chance', [1, 2, 3, 4, 5])).toBe(15);
      expect(calculateCategoryScore('chance', [6, 6, 6, 6, 6])).toBe(30);
    });
  });

  describe('scoring.calculateOptions', () => {
    it('returns options for all 13 categories when sheet is empty', () => {
      const state = makeState(['Alice'], { p1: emptySheet('p1') });
      const options = kniffelMode.scoring.calculateOptions([1, 2, 3, 4, 5], state);
      expect(options).toHaveLength(13);
    });

    it('excludes already-filled categories', () => {
      const sheet = emptySheet('p1');
      sheet.categories.ones = 3;
      sheet.categories.chance = 20;
      const state = makeState(['Alice'], { p1: sheet });
      const options = kniffelMode.scoring.calculateOptions([1, 2, 3, 4, 5], state);
      expect(options).toHaveLength(11);
      expect(options.find((o) => o.id === 'ones')).toBeUndefined();
      expect(options.find((o) => o.id === 'chance')).toBeUndefined();
    });

    it('initializes score sheet if missing', () => {
      const state = makeState(['Alice']);
      const options = kniffelMode.scoring.calculateOptions([1, 1, 1, 1, 1], state);
      expect(options).toHaveLength(13);
      expect(options.find((o) => o.id === 'kniffel').score).toBe(50);
    });

    it('calculates correct scores for each option', () => {
      const state = makeState(['Alice'], { p1: emptySheet('p1') });
      const options = kniffelMode.scoring.calculateOptions([3, 3, 3, 4, 4], state);
      const byId = Object.fromEntries(options.map((o) => [o.id, o.score]));
      expect(byId.threes).toBe(9);
      expect(byId.fours).toBe(8);
      expect(byId.fullHouse).toBe(25);
      expect(byId.threeOfAKind).toBe(17);
      expect(byId.chance).toBe(17);
      expect(byId.kniffel).toBe(0);
    });
  });

  describe('scoring.applyScore', () => {
    it('sets the category score and updates total', () => {
      const state = makeState(['Alice'], { p1: emptySheet('p1') });
      const newState = kniffelMode.scoring.applyScore(
        { id: 'ones', name: 'kniffel.ones', score: 3 },
        state
      );
      expect(newState.scores.p1.categories.ones).toBe(3);
      expect(newState.scores.p1.totalScore).toBe(3);
    });

    it('awards upper bonus when upper block reaches 63', () => {
      const sheet = emptySheet('p1');
      sheet.categories.ones = 3;
      sheet.categories.twos = 6;
      sheet.categories.threes = 9;
      sheet.categories.fours = 12;
      sheet.categories.fives = 15;
      // sixes still open, need 18 to reach 63
      const state = makeState(['Alice'], { p1: sheet });
      const newState = kniffelMode.scoring.applyScore(
        { id: 'sixes', name: 'kniffel.sixes', score: 18 },
        state
      );
      expect(newState.scores.p1.categories.upperBonus).toBe(35);
      expect(newState.scores.p1.totalScore).toBe(3 + 6 + 9 + 12 + 15 + 18 + 35);
    });

    it('does not award bonus when upper block < 63', () => {
      const sheet = emptySheet('p1');
      sheet.categories.ones = 1;
      const state = makeState(['Alice'], { p1: sheet });
      const newState = kniffelMode.scoring.applyScore(
        { id: 'twos', name: 'kniffel.twos', score: 2 },
        state
      );
      expect(newState.scores.p1.categories.upperBonus).toBeNull();
      expect(newState.scores.p1.totalScore).toBe(3);
    });

    it('initializes sheet if missing', () => {
      const state = makeState(['Alice']);
      const newState = kniffelMode.scoring.applyScore(
        { id: 'chance', name: 'kniffel.chance', score: 22 },
        state
      );
      expect(newState.scores.p1.categories.chance).toBe(22);
      expect(newState.scores.p1.totalScore).toBe(22);
    });
  });

  describe('scoring.isGameOver', () => {
    it('returns false when categories are still open', () => {
      const state = makeState(['Alice'], { p1: emptySheet('p1') });
      expect(kniffelMode.scoring.isGameOver(state)).toBe(false);
    });

    it('returns false when one player is complete but another is not', () => {
      const fullSheet = emptySheet('p1');
      for (const cat of kniffelMode.categories) {
        fullSheet.categories[cat] = 0;
      }
      const state = makeState(['Alice', 'Bob'], {
        p1: fullSheet,
        p2: emptySheet('p2'),
      });
      expect(kniffelMode.scoring.isGameOver(state)).toBe(false);
    });

    it('returns true when all players have filled all 13 categories', () => {
      const fullSheet1 = emptySheet('p1');
      const fullSheet2 = emptySheet('p2');
      for (const cat of kniffelMode.categories) {
        fullSheet1.categories[cat] = 0;
        fullSheet2.categories[cat] = 0;
      }
      const state = makeState(['Alice', 'Bob'], {
        p1: fullSheet1,
        p2: fullSheet2,
      });
      expect(kniffelMode.scoring.isGameOver(state)).toBe(true);
    });

    it('returns false when player has no score sheet', () => {
      const state = makeState(['Alice'], {});
      expect(kniffelMode.scoring.isGameOver(state)).toBe(false);
    });
  });

  describe('scoring.getFinalScores', () => {
    it('returns players sorted by total score descending', () => {
      const sheet1 = emptySheet('p1');
      sheet1.categories.ones = 5;
      sheet1.categories.chance = 20;
      const sheet2 = emptySheet('p2');
      sheet2.categories.ones = 3;
      sheet2.categories.chance = 30;
      const state = makeState(['Alice', 'Bob'], { p1: sheet1, p2: sheet2 });
      const result = kniffelMode.scoring.getFinalScores(state);
      expect(result[0].playerId).toBe('p2');
      expect(result[0].totalScore).toBe(33);
      expect(result[1].playerId).toBe('p1');
      expect(result[1].totalScore).toBe(25);
    });

    it('assigns equal rank for tied scores', () => {
      const sheet1 = emptySheet('p1');
      sheet1.categories.chance = 20;
      const sheet2 = emptySheet('p2');
      sheet2.categories.chance = 20;
      const state = makeState(['Alice', 'Bob'], { p1: sheet1, p2: sheet2 });
      const result = kniffelMode.scoring.getFinalScores(state);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(1);
    });

    it('includes upper bonus in final total', () => {
      const sheet = emptySheet('p1');
      sheet.categories.ones = 3;
      sheet.categories.twos = 6;
      sheet.categories.threes = 9;
      sheet.categories.fours = 12;
      sheet.categories.fives = 15;
      sheet.categories.sixes = 18;
      const state = makeState(['Alice'], { p1: sheet });
      const result = kniffelMode.scoring.getFinalScores(state);
      // 3+6+9+12+15+18 = 63, bonus = 35, total = 98
      expect(result[0].totalScore).toBe(98);
    });

    it('handles players with no score sheet', () => {
      const state = makeState(['Alice'], {});
      const result = kniffelMode.scoring.getFinalScores(state);
      expect(result[0].totalScore).toBe(0);
    });

    it('assigns correct ranks with 3 players', () => {
      const s1 = emptySheet('p1');
      s1.categories.chance = 30;
      const s2 = emptySheet('p2');
      s2.categories.chance = 10;
      const s3 = emptySheet('p3');
      s3.categories.chance = 30;
      const state = makeState(['Alice', 'Bob', 'Carol'], { p1: s1, p2: s2, p3: s3 });
      const result = kniffelMode.scoring.getFinalScores(state);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(1);
      expect(result[2].rank).toBe(3);
    });
  });
});

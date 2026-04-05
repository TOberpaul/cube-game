// Kniffel Mode — Vollständiges Kniffel-Regelwerk
// Feature: dice-game-pwa, Anforderung: 5.5

/**
 * All 13 Kniffel scoring categories (excluding upperBonus which is auto-calculated).
 */
const UPPER_CATEGORIES = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
const LOWER_CATEGORIES = [
  'threeOfAKind',
  'fourOfAKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'kniffel',
  'chance',
];
const ALL_CATEGORIES = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES];

/** i18n key mapping for each category */
const CATEGORY_NAMES = {
  ones: 'kniffel.ones',
  twos: 'kniffel.twos',
  threes: 'kniffel.threes',
  fours: 'kniffel.fours',
  fives: 'kniffel.fives',
  sixes: 'kniffel.sixes',
  threeOfAKind: 'kniffel.threeOfAKind',
  fourOfAKind: 'kniffel.fourOfAKind',
  fullHouse: 'kniffel.fullHouse',
  smallStraight: 'kniffel.smallStraight',
  largeStraight: 'kniffel.largeStraight',
  kniffel: 'kniffel.kniffel',
  chance: 'kniffel.chance',
};

const UPPER_BONUS_THRESHOLD = 63;
const UPPER_BONUS_VALUE = 35;
const KNIFFEL_BONUS_VALUE = 50;

// --- Scoring helpers ---

/**
 * Counts occurrences of each die value.
 * @param {number[]} dice
 * @returns {Map<number, number>}
 */
function countValues(dice) {
  const counts = new Map();
  for (const v of dice) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return counts;
}

/**
 * Sum of all dice.
 * @param {number[]} dice
 * @returns {number}
 */
function sumAll(dice) {
  return dice.reduce((a, b) => a + b, 0);
}

/**
 * Calculates the score for a single category given 5 dice.
 * @param {string} category
 * @param {number[]} dice
 * @returns {number}
 */
export function calculateCategoryScore(category, dice) {
  const counts = countValues(dice);
  const maxCount = Math.max(...counts.values());
  const uniqueSorted = [...new Set(dice)].sort((a, b) => a - b);

  switch (category) {
    // Upper block: sum of dice showing that number
    case 'ones':
      return (counts.get(1) || 0) * 1;
    case 'twos':
      return (counts.get(2) || 0) * 2;
    case 'threes':
      return (counts.get(3) || 0) * 3;
    case 'fours':
      return (counts.get(4) || 0) * 4;
    case 'fives':
      return (counts.get(5) || 0) * 5;
    case 'sixes':
      return (counts.get(6) || 0) * 6;

    // Lower block
    case 'threeOfAKind':
      return maxCount >= 3 ? sumAll(dice) : 0;
    case 'fourOfAKind':
      return maxCount >= 4 ? sumAll(dice) : 0;
    case 'fullHouse': {
      const vals = [...counts.values()].sort();
      const isFullHouse = vals.length === 2 && vals[0] === 2 && vals[1] === 3;
      return isFullHouse ? 25 : 0;
    }
    case 'smallStraight':
      return hasConsecutive(uniqueSorted, 4) ? 30 : 0;
    case 'largeStraight':
      return hasConsecutive(uniqueSorted, 5) ? 40 : 0;
    case 'kniffel':
      return maxCount === 5 ? 50 : 0;
    case 'chance':
      return sumAll(dice);
    default:
      return 0;
  }
}

/**
 * Checks if sorted unique values contain n consecutive numbers.
 * @param {number[]} sorted - sorted unique values
 * @param {number} n - required consecutive count
 * @returns {boolean}
 */
function hasConsecutive(sorted, n) {
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

/**
 * Creates an empty Kniffel score sheet for a player.
 * @param {string} playerId
 * @returns {object}
 */
export function createEmptyScoreSheet(playerId) {
  const categories = {};
  for (const cat of ALL_CATEGORIES) {
    categories[cat] = null;
  }
  categories.upperBonus = null;
  return { playerId, totalScore: 0, categories };
}

/**
 * Calculates the upper block total (ones through sixes).
 * @param {object} categories
 * @returns {number}
 */
function upperBlockTotal(categories) {
  let total = 0;
  for (const cat of UPPER_CATEGORIES) {
    if (categories[cat] != null) {
      total += categories[cat];
    }
  }
  return total;
}

/**
 * Calculates total score including upper bonus.
 * @param {object} categories
 * @returns {number}
 */
function calculateTotal(categories) {
  let total = 0;
  for (const cat of ALL_CATEGORIES) {
    if (categories[cat] != null) {
      total += categories[cat];
    }
  }
  // Add upper bonus if applicable
  if (upperBlockTotal(categories) >= UPPER_BONUS_THRESHOLD) {
    total += UPPER_BONUS_VALUE;
  }
  return total;
}

// --- Scoring strategy ---

const kniffelScoring = {
  /**
   * Calculates possible score options for all open categories.
   * @param {number[]} dice - array of 5 dice values
   * @param {object} state - current game state
   * @returns {{ id: string, name: string, score: number }[]}
   */
  calculateOptions(dice, state) {
    const playerId = state.players[state.currentPlayerIndex].id;
    const sheet = state.scores[playerId] || createEmptyScoreSheet(playerId);
    const counts = countValues(dice);
    const maxCount = Math.max(...counts.values());
    const isKniffel = maxCount === 5;
    const kniffelScoredWith50 = sheet.categories.kniffel === 50;

    // Bonus Kniffel: rolled another Kniffel and first one was scored as 50
    const bonusKniffel = isKniffel && kniffelScoredWith50;
    const bonus = bonusKniffel ? KNIFFEL_BONUS_VALUE : 0;

    if (bonusKniffel) {
      const options = [];
      const dieValue = dice[0];
      const upperCat = UPPER_CATEGORIES[dieValue - 1];

      // Prefer matching upper category
      if (sheet.categories[upperCat] == null) {
        options.push({
          id: upperCat,
          name: CATEGORY_NAMES[upperCat],
          score: calculateCategoryScore(upperCat, dice) + bonus,
        });
        return options;
      }

      // Upper is filled → any open lower category (Joker: Full House/Straßen zählen voll)
      for (const cat of LOWER_CATEGORIES) {
        if (sheet.categories[cat] == null) {
          let score;
          if (cat === 'fullHouse') score = 25;
          else if (cat === 'smallStraight') score = 30;
          else if (cat === 'largeStraight') score = 40;
          else score = calculateCategoryScore(cat, dice);
          options.push({ id: cat, name: CATEGORY_NAMES[cat], score: score + bonus });
        }
      }

      // All lower filled → any open upper category (score as 0 for non-matching)
      if (options.length === 0) {
        for (const cat of UPPER_CATEGORIES) {
          if (sheet.categories[cat] == null) {
            options.push({
              id: cat,
              name: CATEGORY_NAMES[cat],
              score: calculateCategoryScore(cat, dice) + bonus,
            });
          }
        }
      }

      return options;
    }

    // Normal scoring
    const options = [];
    for (const cat of ALL_CATEGORIES) {
      if (sheet.categories[cat] == null) {
        options.push({
          id: cat,
          name: CATEGORY_NAMES[cat],
          score: calculateCategoryScore(cat, dice),
        });
      }
    }
    return options;
  },

  /**
   * Applies the chosen score to the player's score sheet.
   * @param {{ id: string, name: string, score: number }} option
   * @param {object} state
   * @returns {object}
   */
  applyScore(option, state) {
    const playerId = state.players[state.currentPlayerIndex].id;
    const sheet = state.scores[playerId] || createEmptyScoreSheet(playerId);

    const newCategories = { ...sheet.categories, [option.id]: option.score };

    // Auto-calculate upper bonus
    const upper = upperBlockTotal(newCategories);
    if (upper >= UPPER_BONUS_THRESHOLD) {
      newCategories.upperBonus = UPPER_BONUS_VALUE;
    }

    const newTotal = calculateTotal(newCategories);

    return {
      ...state,
      scores: {
        ...state.scores,
        [playerId]: {
          ...sheet,
          categories: newCategories,
          totalScore: newTotal,
        },
      },
    };
  },

  /**
   * Checks if all players have filled all 13 categories.
   * @param {object} state
   * @returns {boolean}
   */
  isGameOver(state) {
    for (const player of state.players) {
      const sheet = state.scores[player.id];
      if (!sheet) return false;
      for (const cat of ALL_CATEGORIES) {
        // Check for null OR undefined (key might not exist in categories)
        if (sheet.categories[cat] == null) return false;
      }
    }
    return true;
  },

  /**
   * Calculates final scores with upper bonus, sorted descending with ranks.
   * @param {object} state
   * @returns {{ playerId: string, name: string, totalScore: number, rank: number }[]}
   */
  getFinalScores(state) {
    const scores = state.players.map((p) => {
      const sheet = state.scores[p.id] || createEmptyScoreSheet(p.id);
      return {
        playerId: p.id,
        name: p.name,
        totalScore: calculateTotal(sheet.categories),
      };
    });

    scores.sort((a, b) => b.totalScore - a.totalScore);

    let rank = 1;
    for (let i = 0; i < scores.length; i++) {
      if (i > 0 && scores[i].totalScore < scores[i - 1].totalScore) {
        rank = i + 1;
      }
      scores[i].rank = rank;
    }
    return scores;
  },
};

/**
 * Kniffel game mode configuration.
 */
export const kniffelMode = {
  id: 'kniffel',
  name: 'mode.kniffel',
  diceCount: 5,
  maxPlayers: 8,
  maxRounds: 13,
  rollsPerTurn: 3,
  scoring: kniffelScoring,
  categories: ALL_CATEGORIES,
};

/**
 * Registers the Kniffel mode in the given registry.
 * @param {{ register: Function }} registry
 */
export function registerKniffel(registry) {
  registry.register(kniffelMode);
}

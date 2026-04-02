// Free Roll Mode — Freies Würfeln ohne Regeln
// Feature: dice-game-pwa, Anforderung: 5.4

/**
 * Scoring strategy for free roll mode.
 * Simple sum scoring, no categories, unlimited play.
 */
const freeRollScoring = {
  /**
   * Returns a single option: sum of all dice.
   * @param {number[]} dice
   * @returns {{ id: string, name: string, score: number }[]}
   */
  calculateOptions(dice) {
    const sum = dice.reduce((a, b) => a + b, 0);
    return [{ id: 'sum', name: 'score.sum', score: sum }];
  },

  /**
   * Adds the chosen score to the player's total.
   * @param {{ id: string, name: string, score: number }} option
   * @param {object} state
   * @returns {object}
   */
  applyScore(option, state) {
    const playerId = state.players[state.currentPlayerIndex].id;
    const sheet = state.scores[playerId] || { playerId, totalScore: 0, categories: {} };
    return {
      ...state,
      scores: {
        ...state.scores,
        [playerId]: {
          ...sheet,
          totalScore: sheet.totalScore + option.score,
        },
      },
    };
  },

  /**
   * Always returns false — free roll never ends.
   * @returns {boolean}
   */
  isGameOver() {
    return false;
  },

  /**
   * Returns players sorted by total score descending.
   * @param {object} state
   * @returns {{ playerId: string, name: string, totalScore: number, rank: number }[]}
   */
  getFinalScores(state) {
    const scores = state.players.map((p) => ({
      playerId: p.id,
      name: p.name,
      totalScore: (state.scores[p.id] && state.scores[p.id].totalScore) || 0,
    }));
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
 * Free Roll game mode configuration.
 */
export const freeRollMode = {
  id: 'free-roll',
  name: 'mode.freeRoll',
  diceCount: 6,
  maxPlayers: 8,
  maxRounds: null,
  rollsPerTurn: null,
  scoring: freeRollScoring,
};

/**
 * Registers the free roll mode in the given registry.
 * @param {{ register: Function }} registry
 */
export function registerFreeRoll(registry) {
  registry.register(freeRollMode);
}

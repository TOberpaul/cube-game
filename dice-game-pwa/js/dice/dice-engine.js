// Dice Engine — Kryptografisch sichere Würfelwurf-Logik
// Anforderungen: 4.1, 4.2, 4.4

/**
 * Generates a single random die value (1–6).
 * Uses crypto.getRandomValues() if available, falls back to Math.random().
 * @param {boolean} hasCrypto
 * @returns {number}
 */
function randomDieValue(hasCrypto) {
  if (hasCrypto) {
    // Use rejection sampling to avoid modulo bias
    const arr = new Uint8Array(1);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      crypto.getRandomValues(arr);
      // Values 0–251 map evenly to 6 buckets (252 / 6 = 42)
      if (arr[0] < 252) {
        return (arr[0] % 6) + 1;
      }
    }
  }
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Detects whether the Web Crypto API is available.
 * @returns {boolean}
 */
function detectCrypto() {
  try {
    return typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function';
  } catch {
    return false;
  }
}

/**
 * Creates a DiceEngine instance.
 *
 * @param {object} [options]
 * @param {boolean} [options.useCrypto] - Force crypto on/off. Auto-detected if omitted.
 * @returns {DiceEngine}
 */
export function createDiceEngine(options = {}) {
  const hasCrypto = options.useCrypto !== undefined ? options.useCrypto : detectCrypto();

  if (!hasCrypto) {
    console.warn('Dice Engine: Web Crypto API not available, falling back to Math.random()');
  }

  /** @type {number[]} */
  let values = [];
  /** @type {Set<number>} */
  let held = new Set();
  /** @type {number} */
  let count = 0;

  return {
    /**
     * Rolls dice. Held dice keep their values; others get new random values.
     * @param {number} diceCount - Number of dice to use
     * @param {Set<number>} heldIndices - Indices of dice to keep
     * @returns {{ values: number[], rolledIndices: number[] }}
     */
    roll(diceCount, heldIndices = new Set()) {
      // Ensure values array matches requested count
      if (values.length !== diceCount) {
        values = new Array(diceCount).fill(0);
        held = new Set();
      }

      count = diceCount;
      const rolledIndices = [];

      for (let i = 0; i < diceCount; i++) {
        if (heldIndices.has(i)) {
          // Keep existing value for held dice
          continue;
        }
        values[i] = randomDieValue(hasCrypto);
        rolledIndices.push(i);
      }

      // Sync internal held state with what was passed in
      held = new Set(heldIndices);

      return {
        values: [...values],
        rolledIndices,
      };
    },

    /**
     * Returns the current dice state.
     * @returns {{ values: number[], held: Set<number>, count: number }}
     */
    getState() {
      return {
        values: [...values],
        held: new Set(held),
        count,
      };
    },

    /**
     * Toggles the hold state of a die at the given index.
     * @param {number} index
     */
    toggleHold(index) {
      if (index < 0 || index >= count) return;
      if (held.has(index)) {
        held.delete(index);
      } else {
        held.add(index);
      }
    },

    /**
     * Resets all dice to initial state.
     * @param {number} diceCount
     */
    reset(diceCount) {
      count = diceCount;
      values = new Array(diceCount).fill(0);
      held = new Set();
    },
  };
}

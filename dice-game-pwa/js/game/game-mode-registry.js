// Game Mode Registry — Erweiterbares Spielmodus-System
// Feature: dice-game-pwa, Anforderungen: 5.1, 5.2, 5.3

const REQUIRED_FIELDS = ['id', 'name', 'diceCount', 'maxPlayers', 'scoring'];

/**
 * Validates that a game mode config has all required fields.
 * @param {object} config
 * @throws {Error} if required fields are missing or invalid
 */
function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('GameModeConfig must be a non-null object');
  }

  const missing = REQUIRED_FIELDS.filter((field) => config[field] == null);
  if (missing.length > 0) {
    throw new Error(`GameModeConfig missing required fields: ${missing.join(', ')}`);
  }

  if (typeof config.id !== 'string' || config.id.trim() === '') {
    throw new Error('GameModeConfig.id must be a non-empty string');
  }

  if (typeof config.name !== 'string' || config.name.trim() === '') {
    throw new Error('GameModeConfig.name must be a non-empty string');
  }

  if (typeof config.diceCount !== 'number' || config.diceCount < 1 || config.diceCount > 6) {
    throw new Error('GameModeConfig.diceCount must be a number between 1 and 6');
  }

  if (typeof config.maxPlayers !== 'number' || config.maxPlayers < 1) {
    throw new Error('GameModeConfig.maxPlayers must be a positive number');
  }

  if (typeof config.scoring !== 'object' || config.scoring === null) {
    throw new Error('GameModeConfig.scoring must be a non-null object');
  }
}

/**
 * Creates a new GameModeRegistry instance.
 * @returns {import('./types').GameModeRegistry}
 */
export function createGameModeRegistry() {
  /** @type {Map<string, object>} */
  const modes = new Map();

  return {
    /**
     * Register a game mode configuration.
     * @param {object} config - GameModeConfig with id, name, diceCount, maxPlayers, maxRounds, rollsPerTurn, scoring, categories
     */
    register(config) {
      validateConfig(config);
      modes.set(config.id, { ...config });
    },

    /**
     * Retrieve a game mode by id.
     * @param {string} id
     * @returns {object|undefined}
     */
    get(id) {
      const config = modes.get(id);
      return config ? { ...config } : undefined;
    },

    /**
     * List all registered game modes.
     * @returns {object[]}
     */
    getAll() {
      return Array.from(modes.values()).map((config) => ({ ...config }));
    },
  };
}

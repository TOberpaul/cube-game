// Avatar utility — Animal emoji avatars for players
// Feature: dice-game-pwa

/**
 * Array of animal emoji avatars.
 */
export const AVATARS = ['🐸', '🐼', '🦊', '🐰', '🐱', '🐶', '🦁', '🐨'];

/**
 * Returns an avatar emoji for the given player index.
 * Wraps around if index exceeds array length.
 * @param {number} index
 * @returns {string}
 */
export function getAvatar(index) {
  return AVATARS[index % AVATARS.length];
}

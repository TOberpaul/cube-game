/**
 * Offline Session — Shared state for passing peer and controller between screens.
 * Used to transfer the WebRTC peer connection from the lobby to the game screen
 * without losing the established connection.
 *
 * @module offline-session
 * Feature: offline-multiplayer, Requirements: 3.3, 3.4, 6.3, 6.4
 */

/** @type {{ peer: object|null, role: string|null, playerId: string|null }} */
const session = {
  peer: null,
  role: null,
  playerId: null,
};

/**
 * Stores the offline session data (peer, role, playerId) for transfer between screens.
 * @param {{ peer: object, role: string, playerId: string }} data
 */
export function setOfflineSession(data) {
  session.peer = data.peer || null;
  session.role = data.role || null;
  session.playerId = data.playerId || null;
}

/**
 * Retrieves the current offline session data.
 * @returns {{ peer: object|null, role: string|null, playerId: string|null }}
 */
export function getOfflineSession() {
  return { ...session };
}

/**
 * Clears the offline session data.
 */
export function clearOfflineSession() {
  session.peer = null;
  session.role = null;
  session.playerId = null;
}

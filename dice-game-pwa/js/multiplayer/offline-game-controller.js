/**
 * Offline Game Controller — Orchestriert Spiellogik über den DataChannel
 * Host-Authority-Modell: Host ist die einzige Quelle der Wahrheit für den GameState.
 *
 * @module offline-game-controller
 * Feature: offline-multiplayer, Anforderungen: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 6.3, 6.4
 */

/**
 * Creates a GameAction object with playerId and timestamp.
 * @param {string} playerId - ID of the player performing the action
 * @param {string} type - Action type: "roll", "hold", "score", "sync", "start", "gameOver"
 * @param {object} [payload={}] - Action-specific data
 * @returns {{ type: string, playerId: string, timestamp: number, payload: object }}
 */
export function createGameAction(playerId, type, payload = {}) {
  return {
    type,
    playerId,
    timestamp: Date.now(),
    payload,
  };
}

/**
 * Creates an Offline Game Controller instance.
 *
 * @param {object} options
 * @param {object} options.peer - WebRTC Peer instance (send, onMessage, onConnectionChange)
 * @param {object} options.gameEngine - GameEngine instance
 * @param {boolean} options.isHost - Whether this device is the host
 * @param {string} options.playerId - Local player ID
 * @returns {object} OfflineGameController API
 */
export function createOfflineGameController({ peer, gameEngine, isHost, playerId }) {
  /** @type {object|null} Local copy of game state (client uses this for display) */
  let localState = null;

  /** @type {string} Current connection status tracked internally */
  let connectionStatus = 'connected';

  /** @type {string|null} Previous connection status for reconnection detection */
  let previousConnectionStatus = null;

  /** @type {Array<function(object): void>} */
  const stateChangeHandlers = [];

  /** @type {Array<function(object): void>} */
  const gameOverHandlers = [];

  /** @type {Array<function(string): void>} */
  const connectionStatusChangeHandlers = [];

  /**
   * Notifies all registered state change handlers.
   * @param {object} state
   */
  function emitStateChange(state) {
    for (const handler of stateChangeHandlers) {
      try {
        handler(state);
      } catch (_) {
        // ignore handler errors
      }
    }
  }

  /**
   * Notifies all registered game over handlers.
   * @param {object} state
   */
  function emitGameOver(state) {
    for (const handler of gameOverHandlers) {
      try {
        handler(state);
      } catch (_) {
        // ignore handler errors
      }
    }
  }

  /**
   * Notifies all registered connection status change handlers.
   * @param {string} status
   */
  function emitConnectionStatusChange(status) {
    for (const handler of connectionStatusChangeHandlers) {
      try {
        handler(status);
      } catch (_) {
        // ignore handler errors
      }
    }
  }

  /**
   * Handles connection status changes from the peer.
   * Maps peer statuses to controller-level connection events:
   * - 'reconnecting' (peer) → 'disconnected' (controller) — show warning, keep state
   * - 'disconnected' (peer) → 'failed' (controller) — show message + back button
   * - 'connected' after disconnect → 'connected' (controller) — host sends resync
   * @param {string} peerStatus
   */
  function handleConnectionChange(peerStatus) {
    previousConnectionStatus = connectionStatus;

    switch (peerStatus) {
      case 'reconnecting':
        connectionStatus = 'disconnected';
        emitConnectionStatusChange('disconnected');
        break;
      case 'disconnected':
        connectionStatus = 'failed';
        emitConnectionStatusChange('failed');
        break;
      case 'connected':
        connectionStatus = 'connected';
        emitConnectionStatusChange('connected');

        // If reconnecting after a disconnect, host sends GameState resync
        if (
          isHost &&
          (previousConnectionStatus === 'disconnected' || previousConnectionStatus === 'failed')
        ) {
          const currentState = gameEngine.getState();
          if (currentState) {
            sendState(currentState);
          }
        }
        break;
      case 'connecting':
        connectionStatus = 'connecting';
        emitConnectionStatusChange('connecting');
        break;
    }
  }

  /**
   * Sends a GameAction via the peer data channel.
   * @param {object} action - GameAction to send
   */
  function sendAction(action) {
    peer.send(action);
  }

  /**
   * Sends the current game state to the remote peer as a sync action.
   * @param {object} state - GameState to send
   */
  function sendState(state) {
    const action = createGameAction(playerId, 'sync', { gameState: state });
    sendAction(action);
  }

  /**
   * Host: Processes a received GameAction from the client.
   * Applies the action to the game engine and sends the updated state back.
   * @param {object} action - Received GameAction
   */
  function hostHandleRemoteAction(action) {
    const state = gameEngine.getState();
    if (!state || state.status !== 'playing') return;

    // Verify it's the remote player's turn
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer) return;

    // For game actions (roll, hold, score), check if the sender is the current player
    if (['roll', 'hold', 'score'].includes(action.type)) {
      if (currentPlayer.id !== action.playerId) {
        // Not this player's turn — ignore
        return;
      }
    }

    try {
      switch (action.type) {
        case 'roll':
          gameEngine.roll();
          break;
        case 'hold':
          if (action.payload && typeof action.payload.dieIndex === 'number') {
            gameEngine.toggleHold(action.payload.dieIndex);
          }
          break;
        case 'score':
          if (action.payload) {
            gameEngine.selectScore(action.payload);
          }
          break;
        default:
          // Unknown action type — ignore
          return;
      }
    } catch (_) {
      // Invalid action — ignore
      return;
    }

    // Send updated state to client
    const updatedState = gameEngine.getState();
    localState = updatedState;
    sendState(updatedState);
    emitStateChange(updatedState);

    if (updatedState.status === 'finished') {
      emitGameOver(updatedState);
    }
  }

  /**
   * Client: Processes a received message from the host.
   * Replaces local state with the received GameState.
   * @param {object} action - Received message (GameAction with sync/start/gameOver type)
   */
  function clientHandleRemoteAction(action) {
    if (action.type === 'sync' || action.type === 'start' || action.type === 'gameOver') {
      const gameState = action.payload && action.payload.gameState;
      if (gameState) {
        localState = gameState;
        emitStateChange(gameState);

        if (gameState.status === 'finished' || action.type === 'gameOver') {
          emitGameOver(gameState);
        }
      }
    }
  }

  /**
   * Handles incoming messages from the peer.
   * Routes to host or client handler based on role.
   * @param {object} action - Received message
   */
  function handleRemoteAction(action) {
    if (!action || typeof action !== 'object' || !action.type) return;

    if (isHost) {
      hostHandleRemoteAction(action);
    } else {
      clientHandleRemoteAction(action);
    }
  }

  // Register the message handler on the peer
  peer.onMessage(handleRemoteAction);

  // Register the connection change handler on the peer
  peer.onConnectionChange(handleConnectionChange);

  return {
    /**
     * Starts a new game (host only).
     * Creates the initial GameState and sends it to the client.
     * @param {string} modeId - Game mode ID (e.g. "kniffel", "free-roll")
     * @param {{ id: string, name: string }[]} players - Array of player objects
     * @returns {object} Initial GameState
     */
    startGame(modeId, players) {
      if (!isHost) {
        throw new Error('Only the host can start a game');
      }

      const initialState = gameEngine.startGame(modeId, players);
      localState = initialState;

      // Send initial state to client
      const action = createGameAction(playerId, 'start', { gameState: initialState });
      sendAction(action);

      emitStateChange(initialState);
      return initialState;
    },

    /**
     * Creates and sends a local game action to the remote peer.
     * Host: applies locally and sends updated state.
     * Client: sends action to host for processing.
     * @param {string} type - Action type
     * @param {object} [payload={}] - Action payload
     */
    performAction(type, payload = {}) {
      const action = createGameAction(playerId, type, payload);

      if (isHost) {
        // Host applies locally
        hostHandleRemoteAction(action);
      } else {
        // Client sends to host
        sendAction(action);
      }
    },

    /**
     * Checks if it's the local player's turn.
     * @returns {boolean}
     */
    isMyTurn() {
      const state = isHost ? gameEngine.getState() : localState;
      if (!state || !state.players || state.status !== 'playing') return false;

      const currentPlayer = state.players[state.currentPlayerIndex];
      return currentPlayer ? currentPlayer.id === playerId : false;
    },

    /**
     * Returns the current local game state.
     * @returns {object|null}
     */
    getState() {
      return isHost ? gameEngine.getState() : localState;
    },

    /**
     * Registers a handler for state changes.
     * @param {function(object): void} handler
     */
    onStateChange(handler) {
      stateChangeHandlers.push(handler);
    },

    /**
     * Registers a handler for game over events.
     * @param {function(object): void} handler
     */
    onGameOver(handler) {
      gameOverHandlers.push(handler);
    },

    /**
     * Registers a handler for connection status changes.
     * Status values: 'connected', 'disconnected', 'failed', 'connecting'
     * @param {function(string): void} handler
     */
    onConnectionStatusChange(handler) {
      connectionStatusChangeHandlers.push(handler);
    },

    /**
     * Returns the current connection status.
     * @returns {string}
     */
    getConnectionStatus() {
      return connectionStatus;
    },

    /**
     * Whether this controller is the host.
     * @returns {boolean}
     */
    getIsHost() {
      return isHost;
    },

    /**
     * The local player ID.
     * @returns {string}
     */
    getPlayerId() {
      return playerId;
    },

    /**
     * Cleans up event listeners and references.
     */
    destroy() {
      stateChangeHandlers.length = 0;
      gameOverHandlers.length = 0;
      connectionStatusChangeHandlers.length = 0;
      localState = null;
    },
  };
}

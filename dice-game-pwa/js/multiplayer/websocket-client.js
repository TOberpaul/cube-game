/**
 * WebSocket Client for Online Multiplayer
 * Handles connection, reconnection with exponential backoff, and GameAction messaging.
 *
 * @module websocket-client
 */

const STATUS = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
};

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

/**
 * Creates a WebSocket client instance.
 * @returns {object} WebSocket client API
 */
export function createWebSocketClient() {
  /** @type {WebSocket|null} */
  let socket = null;
  let status = STATUS.DISCONNECTED;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let currentUrl = null;
  let currentGameId = null;
  let intentionalClose = false;

  /** @type {Array<function>} */
  const messageHandlers = [];
  /** @type {Array<function>} */
  const connectionChangeHandlers = [];

  function setStatus(newStatus) {
    if (status === newStatus) return;
    status = newStatus;
    for (const handler of connectionChangeHandlers) {
      try {
        handler(status);
      } catch (_) {
        // ignore handler errors
      }
    }
  }

  function handleOpen() {
    reconnectAttempts = 0;
    setStatus(STATUS.CONNECTED);
  }

  function handleMessage(event) {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (_) {
      return; // ignore non-JSON messages
    }
    for (const handler of messageHandlers) {
      try {
        handler(data);
      } catch (_) {
        // ignore handler errors
      }
    }
  }

  function handleClose() {
    socket = null;
    if (intentionalClose) {
      setStatus(STATUS.DISCONNECTED);
      return;
    }
    attemptReconnect();
  }

  function handleError() {
    // The close event will fire after error, so reconnect logic is handled there.
  }

  function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      setStatus(STATUS.DISCONNECTED);
      return;
    }

    setStatus(STATUS.RECONNECTING);
    const delay = BASE_DELAY_MS * Math.pow(2, reconnectAttempts);
    reconnectAttempts++;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectInternal(currentUrl, currentGameId).catch(() => {
        // If connect fails, handleClose will trigger next attempt
      });
    }, delay);
  }

  function connectInternal(url, gameId) {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = gameId ? `${url}?gameId=${encodeURIComponent(gameId)}` : url;
        const ws = new WebSocket(wsUrl);

        ws.addEventListener('open', () => {
          socket = ws;
          handleOpen();
          resolve();
        });

        ws.addEventListener('message', handleMessage);
        ws.addEventListener('close', handleClose);
        ws.addEventListener('error', () => {
          handleError();
          if (ws.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket connection failed'));
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  function cleanUp() {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      intentionalClose = true;
      socket.close();
      socket = null;
    }
  }

  return {
    /**
     * Connect to a WebSocket server.
     * @param {string} url - WebSocket server URL
     * @param {string} [gameId] - Game ID to join
     * @returns {Promise<void>}
     */
    connect(url, gameId) {
      cleanUp();
      intentionalClose = false;
      reconnectAttempts = 0;
      currentUrl = url;
      currentGameId = gameId || null;
      setStatus(STATUS.CONNECTING);
      return connectInternal(url, gameId);
    },

    /**
     * Send a GameAction as JSON.
     * @param {object} action - GameAction to send
     */
    send(action) {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket is not connected');
      }
      socket.send(JSON.stringify(action));
    },

    /**
     * Register a handler for incoming messages.
     * @param {function} handler - Called with parsed GameAction
     */
    onMessage(handler) {
      messageHandlers.push(handler);
    },

    /**
     * Register a handler for connection status changes.
     * @param {function} handler - Called with status string
     */
    onConnectionChange(handler) {
      connectionChangeHandlers.push(handler);
    },

    /**
     * Close the connection intentionally (no reconnect).
     */
    disconnect() {
      intentionalClose = true;
      cleanUp();
      setStatus(STATUS.DISCONNECTED);
    },

    /**
     * Get current connection status.
     * @returns {'connecting'|'connected'|'disconnected'|'reconnecting'}
     */
    getStatus() {
      return status;
    },
  };
}

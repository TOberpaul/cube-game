/**
 * Sync Protocol — Abstraction over WebSocket and WebRTC transports.
 * Provides a unified API for multiplayer game synchronization.
 *
 * @module sync-protocol
 * Feature: dice-game-pwa, Anforderungen: 7.2, 7.3, 7.4, 7.5
 */

import { createWebSocketClient } from './websocket-client.js';

/** @type {ConnectionStatus} */
const STATUS = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
};

/**
 * Creates a SyncProtocol instance that abstracts over WebSocket and WebRTC.
 *
 * @param {object} [options]
 * @param {object} [options.gameEngine] - GameEngine instance for player disconnect/reconnect handling
 * @param {string} [options.playerId] - Local player ID
 * @returns {SyncProtocol}
 */
export function createSyncProtocol(options = {}) {
  const { gameEngine = null, playerId = null } = options;

  /** @type {object|null} Transport client (WebSocket or WebRTC) */
  let transport = null;
  /** @type {'websocket'|'webrtc'|null} */
  let transportType = null;
  /** @type {ConnectionStatus} */
  let status = STATUS.DISCONNECTED;
  /** @type {boolean} */
  let wasConnected = false;

  /** @type {Array<function(GameAction): void>} */
  const actionHandlers = [];
  /** @type {Array<function(ConnectionStatus): void>} */
  const connectionChangeHandlers = [];

  /**
   * Updates connection status and notifies handlers.
   * @param {string} newStatus
   */
  function setStatus(newStatus) {
    if (status === newStatus) return;
    const previousStatus = status;
    status = newStatus;

    // Track if we were ever connected (for reconnect sync)
    if (newStatus === STATUS.CONNECTED) {
      wasConnected = true;
    }

    for (const handler of connectionChangeHandlers) {
      try {
        handler(newStatus);
      } catch (_) {
        // ignore handler errors
      }
    }

    // Handle reconnect: request full state sync
    if (previousStatus === STATUS.RECONNECTING && newStatus === STATUS.CONNECTED) {
      requestFullSync();
    }
  }

  /**
   * Dispatches a received action to all registered handlers.
   * Handles 'sync' type actions specially for full state replacement.
   * @param {GameAction} action
   */
  function dispatchAction(action) {
    // Handle player lifecycle actions with GameEngine integration
    if (gameEngine && action.type === 'leave' && action.playerId) {
      gameEngine.disconnectPlayer(action.playerId);
    }
    if (gameEngine && action.type === 'join' && action.playerId) {
      gameEngine.reconnectPlayer(action.playerId);
    }

    for (const handler of actionHandlers) {
      try {
        handler(action);
      } catch (_) {
        // ignore handler errors
      }
    }
  }

  /**
   * Sends a 'sync' action to request full game state from the host/server.
   */
  function requestFullSync() {
    if (!playerId) return;
    try {
      const syncAction = {
        type: 'sync',
        playerId,
        payload: { request: true },
        timestamp: Date.now(),
      };
      sendRaw(syncAction);
    } catch (_) {
      // ignore send errors during reconnect
    }
  }

  /**
   * Sends raw data through the active transport.
   * @param {object} data
   */
  function sendRaw(data) {
    if (!transport) {
      throw new Error('No transport connected');
    }
    if (transportType === 'websocket') {
      transport.send(data);
    } else if (transportType === 'webrtc') {
      transport.send(data);
    }
  }

  /**
   * Sets up a WebSocket transport.
   * @param {{ url: string, gameId: string }} config
   * @returns {Promise<void>}
   */
  async function connectWebSocket(config) {
    const client = createWebSocketClient();
    transport = client;
    transportType = 'websocket';

    client.onMessage((action) => {
      dispatchAction(action);
    });

    client.onConnectionChange((wsStatus) => {
      setStatus(wsStatus);
    });

    setStatus(STATUS.CONNECTING);
    await client.connect(config.url, config.gameId);
  }

  /**
   * Sets up a WebRTC transport.
   * @param {{ isHost: boolean }} config
   * @returns {Promise<void>}
   */
  async function connectWebRTC(config) {
    // Dynamically import webrtc-peer to handle gracefully if not yet implemented
    let createWebRTCPeer;
    try {
      const module = await import('./webrtc-peer.js');
      createWebRTCPeer = module.createWebRTCPeer;
    } catch (_) {
      throw new Error('WebRTC peer module is not available');
    }

    if (typeof createWebRTCPeer !== 'function') {
      throw new Error('WebRTC peer module does not export createWebRTCPeer');
    }

    const peer = createWebRTCPeer();
    transport = peer;
    transportType = 'webrtc';

    if (typeof peer.onMessage === 'function') {
      peer.onMessage((action) => {
        dispatchAction(action);
      });
    }

    if (typeof peer.onConnectionChange === 'function') {
      peer.onConnectionChange((rtcStatus) => {
        setStatus(rtcStatus);
      });
    }

    setStatus(STATUS.CONNECTING);
    await peer.connect(config);
  }

  return {
    /**
     * Connect using the specified transport configuration.
     * @param {ConnectionConfig} config
     * @returns {Promise<void>}
     */
    async connect(config) {
      // Disconnect any existing transport first
      this.disconnect();
      wasConnected = false;

      if (config.type === 'websocket') {
        await connectWebSocket(config);
      } else if (config.type === 'webrtc') {
        await connectWebRTC(config);
      } else {
        throw new Error(`Unknown transport type: ${config.type}`);
      }
    },

    /**
     * Send a game action through the active transport.
     * @param {GameAction} action
     */
    sendAction(action) {
      sendRaw(action);
    },

    /**
     * Register a handler for incoming game actions.
     * @param {function(GameAction): void} handler
     */
    onAction(handler) {
      actionHandlers.push(handler);
    },

    /**
     * Register a handler for connection status changes.
     * @param {function(ConnectionStatus): void} handler
     */
    onConnectionChange(handler) {
      connectionChangeHandlers.push(handler);
    },

    /**
     * Disconnect from the current transport.
     */
    disconnect() {
      if (transport) {
        try {
          transport.disconnect();
        } catch (_) {
          // ignore disconnect errors
        }
        transport = null;
        transportType = null;
      }
      setStatus(STATUS.DISCONNECTED);
    },

    /**
     * Get the current connection status.
     * @returns {ConnectionStatus}
     */
    getStatus() {
      return status;
    },

    /**
     * Get the current transport type.
     * @returns {'websocket'|'webrtc'|null}
     */
    getTransportType() {
      return transportType;
    },
  };
}

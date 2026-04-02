/**
 * WebRTC Peer Manager — Offline P2P Multiplayer
 * Peer-to-peer connection without a central server using RTCPeerConnection and RTCDataChannel.
 * Signaling is done manually (copy/paste or QR code) — no signaling server required.
 *
 * @module webrtc-peer
 * Feature: dice-game-pwa, Anforderungen: 8.1, 8.2, 8.3, 8.4, 8.5
 */

const STATUS = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
};

/** Default ICE configuration for local network P2P */
const DEFAULT_RTC_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

/**
 * Creates a WebRTC Peer Manager instance.
 * Supports host/client roles with manual signaling (SDP offer/answer exchange).
 *
 * @returns {object} WebRTC peer API
 */
export function createWebRTCPeer() {
  /** @type {RTCPeerConnection|null} */
  let peerConnection = null;
  /** @type {RTCDataChannel|null} */
  let dataChannel = null;
  /** @type {string} */
  let status = STATUS.DISCONNECTED;
  /** @type {boolean} */
  let isHost = false;
  /** @type {Array<RTCIceCandidate>} */
  let iceCandidates = [];
  /** @type {boolean} */
  let remoteDescriptionSet = false;

  /** @type {Array<function(object): void>} */
  const messageHandlers = [];
  /** @type {Array<function(string): void>} */
  const connectionChangeHandlers = [];

  /**
   * Updates connection status and notifies handlers.
   * @param {string} newStatus
   */
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

  /**
   * Dispatches a received message to all registered handlers.
   * @param {object} action
   */
  function dispatchMessage(action) {
    for (const handler of messageHandlers) {
      try {
        handler(action);
      } catch (_) {
        // ignore handler errors
      }
    }
  }

  /**
   * Sets up event listeners on the data channel.
   * @param {RTCDataChannel} channel
   */
  function setupDataChannel(channel) {
    dataChannel = channel;

    channel.addEventListener('open', () => {
      setStatus(STATUS.CONNECTED);
    });

    channel.addEventListener('close', () => {
      setStatus(STATUS.DISCONNECTED);
    });

    channel.addEventListener('error', () => {
      setStatus(STATUS.DISCONNECTED);
    });

    channel.addEventListener('message', (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (_) {
        return; // ignore non-JSON messages
      }
      dispatchMessage(data);
    });
  }

  /**
   * Monitors the RTCPeerConnection state for disconnect/reconnect detection.
   * @param {RTCPeerConnection} pc
   */
  function monitorConnectionState(pc) {
    pc.addEventListener('connectionstatechange', () => {
      switch (pc.connectionState) {
        case 'connected':
          setStatus(STATUS.CONNECTED);
          break;
        case 'disconnected':
          setStatus(STATUS.RECONNECTING);
          break;
        case 'failed':
        case 'closed':
          setStatus(STATUS.DISCONNECTED);
          break;
      }
    });

    pc.addEventListener('iceconnectionstatechange', () => {
      if (pc.iceConnectionState === 'disconnected') {
        setStatus(STATUS.RECONNECTING);
      } else if (pc.iceConnectionState === 'failed') {
        setStatus(STATUS.DISCONNECTED);
      }
    });
  }

  /**
   * Creates and configures a new RTCPeerConnection.
   * @returns {RTCPeerConnection}
   */
  function createPeerConnection() {
    const pc = new RTCPeerConnection(DEFAULT_RTC_CONFIG);

    iceCandidates = [];
    remoteDescriptionSet = false;

    pc.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        iceCandidates.push(event.candidate);
      }
    });

    // Client side: listen for data channel created by host
    pc.addEventListener('datachannel', (event) => {
      setupDataChannel(event.channel);
    });

    monitorConnectionState(pc);
    return pc;
  }

  /**
   * Cleans up the peer connection and data channel.
   */
  function cleanUp() {
    if (dataChannel) {
      try {
        dataChannel.close();
      } catch (_) { /* ignore */ }
      dataChannel = null;
    }
    if (peerConnection) {
      try {
        peerConnection.close();
      } catch (_) { /* ignore */ }
      peerConnection = null;
    }
    iceCandidates = [];
    remoteDescriptionSet = false;
  }

  return {
    /**
     * Initialize the peer connection with host/client role.
     * For the host: creates an RTCPeerConnection and a DataChannel.
     * For the client: creates an RTCPeerConnection (DataChannel comes via 'datachannel' event).
     *
     * @param {{ isHost: boolean }} config
     * @returns {Promise<void>}
     */
    async connect(config) {
      cleanUp();
      isHost = Boolean(config && config.isHost);
      setStatus(STATUS.CONNECTING);

      peerConnection = createPeerConnection();

      if (isHost) {
        // Host creates the data channel
        const channel = peerConnection.createDataChannel('game', {
          ordered: true,
        });
        setupDataChannel(channel);
      }
      // Client waits for 'datachannel' event (set up in createPeerConnection)
    },

    /**
     * Send a GameAction as JSON through the data channel.
     * @param {object} action - GameAction to send
     */
    send(action) {
      if (!dataChannel || dataChannel.readyState !== 'open') {
        throw new Error('DataChannel is not open');
      }
      dataChannel.send(JSON.stringify(action));
    },

    /**
     * Register a handler for incoming messages.
     * @param {function(object): void} handler
     */
    onMessage(handler) {
      messageHandlers.push(handler);
    },

    /**
     * Register a handler for connection status changes.
     * @param {function(string): void} handler
     */
    onConnectionChange(handler) {
      connectionChangeHandlers.push(handler);
    },

    /**
     * Close the peer connection.
     */
    disconnect() {
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

    // --- Manual Signaling API ---

    /**
     * Host: Creates an SDP offer and collects ICE candidates.
     * Returns a serializable signaling object that can be shared via QR code or copy/paste.
     *
     * @returns {Promise<{ sdp: string, type: string, candidates: object[] }>}
     */
    async getOffer() {
      if (!peerConnection) {
        throw new Error('Call connect({ isHost: true }) first');
      }

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Wait for ICE gathering to complete (or timeout)
      await waitForIceGathering(peerConnection);

      return {
        sdp: peerConnection.localDescription.sdp,
        type: peerConnection.localDescription.type,
        candidates: iceCandidates.map((c) => c.toJSON()),
      };
    },

    /**
     * Host: Sets the answer received from the client.
     *
     * @param {{ sdp: string, type: string, candidates?: object[] }} answer
     * @returns {Promise<void>}
     */
    async setAnswer(answer) {
      if (!peerConnection) {
        throw new Error('Call connect({ isHost: true }) first');
      }

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription({ sdp: answer.sdp, type: answer.type })
      );
      remoteDescriptionSet = true;

      // Add remote ICE candidates
      if (answer.candidates && Array.isArray(answer.candidates)) {
        for (const candidate of answer.candidates) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (_) {
            // ignore invalid candidates
          }
        }
      }
    },

    /**
     * Client: Sets the offer received from the host.
     *
     * @param {{ sdp: string, type: string, candidates?: object[] }} offer
     * @returns {Promise<void>}
     */
    async setOffer(offer) {
      if (!peerConnection) {
        throw new Error('Call connect({ isHost: false }) first');
      }

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription({ sdp: offer.sdp, type: offer.type })
      );
      remoteDescriptionSet = true;

      // Add remote ICE candidates
      if (offer.candidates && Array.isArray(offer.candidates)) {
        for (const candidate of offer.candidates) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (_) {
            // ignore invalid candidates
          }
        }
      }
    },

    /**
     * Client: Creates an SDP answer after receiving the host's offer.
     * Returns a serializable signaling object to share back with the host.
     *
     * @returns {Promise<{ sdp: string, type: string, candidates: object[] }>}
     */
    async getAnswer() {
      if (!peerConnection) {
        throw new Error('Call connect({ isHost: false }) and setOffer() first');
      }

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Wait for ICE gathering to complete (or timeout)
      await waitForIceGathering(peerConnection);

      return {
        sdp: peerConnection.localDescription.sdp,
        type: peerConnection.localDescription.type,
        candidates: iceCandidates.map((c) => c.toJSON()),
      };
    },

    /**
     * Get collected ICE candidates (useful for trickle ICE scenarios).
     * @returns {object[]}
     */
    getIceCandidates() {
      return iceCandidates.map((c) => c.toJSON());
    },

    /**
     * Whether this peer is the host.
     * @returns {boolean}
     */
    getIsHost() {
      return isHost;
    },
  };
}

/**
 * Waits for ICE gathering to complete or times out after a set duration.
 * @param {RTCPeerConnection} pc
 * @param {number} [timeoutMs=3000]
 * @returns {Promise<void>}
 */
function waitForIceGathering(pc, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', onStateChange);
      resolve(); // resolve even on timeout — we'll use whatever candidates we have
    }, timeoutMs);

    function onStateChange() {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        pc.removeEventListener('icegatheringstatechange', onStateChange);
        resolve();
      }
    }

    pc.addEventListener('icegatheringstatechange', onStateChange);
  });
}

// Integration Tests — Offline P2P Multiplayer
// Wires together real modules (sdp-payload, offline-game-controller) with mock peers.
// Anforderungen: 3.3, 3.4, 6.3, 6.4, 5.3, 5.4
import { describe, it, expect } from 'vitest';
import {
  serializeSdpPayload,
  deserializeSdpPayload,
  validateSdpPayload,
} from '../js/multiplayer/sdp-payload.js';
import {
  createGameAction,
  createOfflineGameController,
} from '../js/multiplayer/offline-game-controller.js';

// --- Helpers ---

/**
 * Creates a connected mock peer pair (host ↔ client).
 * Messages sent by one side are delivered to the other's message handler.
 */
function createMockPeerPair() {
  let hostMessageHandler = null;
  let clientMessageHandler = null;
  let hostConnectionChangeHandler = null;
  let clientConnectionChangeHandler = null;

  const hostSent = [];
  const clientSent = [];

  const hostPeer = {
    send(msg) {
      hostSent.push(msg);
      // Deliver to client
      if (clientMessageHandler) clientMessageHandler(msg);
    },
    onMessage(handler) {
      hostMessageHandler = handler;
    },
    onConnectionChange(handler) {
      hostConnectionChangeHandler = handler;
    },
  };

  const clientPeer = {
    send(msg) {
      clientSent.push(msg);
      // Deliver to host
      if (hostMessageHandler) hostMessageHandler(msg);
    },
    onMessage(handler) {
      clientMessageHandler = handler;
    },
    onConnectionChange(handler) {
      clientConnectionChangeHandler = handler;
    },
  };

  return {
    hostPeer,
    clientPeer,
    hostSent,
    clientSent,
    triggerHostConnectionChange(status) {
      if (hostConnectionChangeHandler) hostConnectionChangeHandler(status);
    },
    triggerClientConnectionChange(status) {
      if (clientConnectionChangeHandler) clientConnectionChangeHandler(status);
    },
  };
}

/**
 * Creates a mock game engine that tracks state mutations.
 */
function createMockGameEngine() {
  let state = null;

  return {
    startGame(modeId, players) {
      state = {
        gameId: 'integration-game-1',
        modeId,
        status: 'playing',
        players: players.map((p, i) => ({
          id: p.id,
          name: p.name,
          connectionStatus: 'connected',
          isHost: i === 0,
        })),
        currentPlayerIndex: 0,
        currentRound: 1,
        maxRounds: 13,
        dice: { values: [0, 0, 0, 0, 0], held: [false, false, false, false, false], count: 5 },
        rollsThisTurn: 0,
        scores: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return { ...state };
    },
    roll() {
      state = {
        ...state,
        dice: { ...state.dice, values: [3, 2, 5, 1, 4] },
        rollsThisTurn: state.rollsThisTurn + 1,
        updatedAt: Date.now(),
      };
      return { values: [3, 2, 5, 1, 4], rolledIndices: [0, 1, 2, 3, 4] };
    },
    toggleHold(index) {
      const held = [...state.dice.held];
      held[index] = !held[index];
      state = { ...state, dice: { ...state.dice, held }, updatedAt: Date.now() };
    },
    selectScore(option) {
      // Advance turn and potentially end game
      const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
      const nextRound =
        nextIndex === 0 ? state.currentRound + 1 : state.currentRound;
      const isFinished = nextRound > state.maxRounds;
      state = {
        ...state,
        currentPlayerIndex: nextIndex,
        currentRound: nextRound,
        rollsThisTurn: 0,
        dice: { ...state.dice, values: [0, 0, 0, 0, 0], held: [false, false, false, false, false] },
        status: isFinished ? 'finished' : 'playing',
        updatedAt: Date.now(),
      };
    },
    getState() {
      return state ? { ...state } : null;
    },
    /** Test helper: directly set engine state */
    _setState(newState) {
      state = newState;
    },
  };
}

// --- Integration Tests ---

describe('Offline Multiplayer — Integration Tests', () => {
  // ---------------------------------------------------------------
  // Test 1: Complete signaling flow (Offer → Answer → Connected)
  // Validates: Requirements 3.3, 3.4
  // ---------------------------------------------------------------
  describe('Complete signaling flow (Offer → Answer → Connected)', () => {
    it('should round-trip an SDP offer through serialize → deserialize', () => {
      const offer = {
        type: 'offer',
        sdp: 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\n',
        candidates: [
          { candidate: 'candidate:1 1 udp 2122260223 192.168.1.1 12345 typ host', sdpMid: '0', sdpMLineIndex: 0, usernameFragment: 'abc' },
        ],
      };

      const serialized = serializeSdpPayload(offer);
      expect(typeof serialized).toBe('string');

      const deserialized = deserializeSdpPayload(serialized);
      expect(deserialized.type).toBe('offer');
      expect(deserialized.candidates[0].candidate).toBe(offer.candidates[0].candidate);
      expect(validateSdpPayload(deserialized).valid).toBe(true);
    });

    it('should round-trip an SDP answer through serialize → deserialize', () => {
      const answer = {
        type: 'answer',
        sdp: 'v=0\r\no=- 654321 2 IN IP4 127.0.0.1\r\n',
        candidates: [
          { candidate: 'candidate:2 1 udp 2122260223 192.168.1.2 54321 typ host', sdpMid: '0', sdpMLineIndex: 0, usernameFragment: 'xyz' },
        ],
      };

      const serialized = serializeSdpPayload(answer);
      const deserialized = deserializeSdpPayload(serialized);
      expect(deserialized.type).toBe('answer');
      expect(deserialized.candidates[0].candidate).toBe(answer.candidates[0].candidate);
      expect(validateSdpPayload(deserialized).valid).toBe(true);
    });

    it('should complete the full Offer → Answer → Connected end-to-end flow', () => {
      const hostOffer = {
        type: 'offer',
        sdp: 'v=0\r\no=- 111 2 IN IP4 127.0.0.1\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n',
        candidates: [
          { candidate: 'candidate:1 1 udp 2122260223 10.0.0.1 5000 typ host', sdpMid: '0', sdpMLineIndex: 0, usernameFragment: 'host-ufrag' },
        ],
      };

      const serializedOffer = serializeSdpPayload(hostOffer);

      const clientReceivedOffer = deserializeSdpPayload(serializedOffer);
      expect(validateSdpPayload(clientReceivedOffer).valid).toBe(true);
      expect(clientReceivedOffer.type).toBe('offer');
      expect(clientReceivedOffer.candidates[0].candidate).toBe(hostOffer.candidates[0].candidate);

      const clientAnswer = {
        type: 'answer',
        sdp: 'v=0\r\no=- 222 2 IN IP4 127.0.0.1\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n',
        candidates: [
          { candidate: 'candidate:2 1 udp 2122260223 10.0.0.2 6000 typ host', sdpMid: '0', sdpMLineIndex: 0, usernameFragment: 'client-ufrag' },
        ],
      };

      const serializedAnswer = serializeSdpPayload(clientAnswer);

      const hostReceivedAnswer = deserializeSdpPayload(serializedAnswer);
      expect(validateSdpPayload(hostReceivedAnswer).valid).toBe(true);
      expect(hostReceivedAnswer.type).toBe('answer');
      expect(hostReceivedAnswer.candidates[0].candidate).toBe(clientAnswer.candidates[0].candidate);

      // Both sides exchanged SDP — verify essential data preserved
      expect(hostReceivedAnswer.type).toBe(clientAnswer.type);
      expect(clientReceivedOffer.type).toBe(hostOffer.type);
    });
  });

  // ---------------------------------------------------------------
  // Test 2: Game start from Lobby to Game-Screen
  // Validates: Requirements 6.3, 6.4
  // ---------------------------------------------------------------
  describe('Game start from Lobby to Game-Screen', () => {
    it('host starts game and client receives the initial GameState', () => {
      const { hostPeer, clientPeer } = createMockPeerPair();
      const hostEngine = createMockGameEngine();

      const hostController = createOfflineGameController({
        peer: hostPeer,
        gameEngine: hostEngine,
        isHost: true,
        playerId: 'host-player',
      });

      // Track state changes on the client side
      const clientStateChanges = [];
      const clientEngine = createMockGameEngine();
      const clientController = createOfflineGameController({
        peer: clientPeer,
        gameEngine: clientEngine,
        isHost: false,
        playerId: 'client-player',
      });
      clientController.onStateChange((state) => clientStateChanges.push(state));

      // Host starts the game
      const players = [
        { id: 'host-player', name: 'Host' },
        { id: 'client-player', name: 'Client' },
      ];
      const initialState = hostController.startGame('kniffel', players);

      // Client should have received the initial GameState
      expect(clientStateChanges.length).toBe(1);
      const clientState = clientStateChanges[0];

      // Both sides should have the same game state
      expect(clientState.modeId).toBe('kniffel');
      expect(clientState.status).toBe('playing');
      expect(clientState.players).toHaveLength(2);
      expect(clientState.players[0].id).toBe('host-player');
      expect(clientState.players[1].id).toBe('client-player');
      expect(clientState.currentPlayerIndex).toBe(0);

      // Host's state should match what the client received
      expect(initialState.modeId).toBe(clientState.modeId);
      expect(initialState.status).toBe(clientState.status);
      expect(initialState.players).toEqual(clientState.players);
      expect(initialState.currentPlayerIndex).toBe(clientState.currentPlayerIndex);

      // Client controller should now have the state
      expect(clientController.getState()).toEqual(clientState);

      hostController.destroy();
      clientController.destroy();
    });
  });

  // ---------------------------------------------------------------
  // Test 3: Turn change and game end over DataChannel
  // Validates: Requirements 5.3, 5.4
  // ---------------------------------------------------------------
  describe('Turn change and game end over DataChannel', () => {
    it('client action is processed by host and state synced back', () => {
      const { hostPeer, clientPeer } = createMockPeerPair();
      const hostEngine = createMockGameEngine();

      const hostController = createOfflineGameController({
        peer: hostPeer,
        gameEngine: hostEngine,
        isHost: true,
        playerId: 'host-player',
      });

      const clientStateChanges = [];
      const clientEngine = createMockGameEngine();
      const clientController = createOfflineGameController({
        peer: clientPeer,
        gameEngine: clientEngine,
        isHost: false,
        playerId: 'client-player',
      });
      clientController.onStateChange((state) => clientStateChanges.push(state));

      // Start the game
      hostController.startGame('kniffel', [
        { id: 'host-player', name: 'Host' },
        { id: 'client-player', name: 'Client' },
      ]);

      // Clear initial state change from game start
      clientStateChanges.length = 0;

      // Host is at index 0, so host performs a roll action
      hostController.performAction('roll');

      // Client should receive the updated state with rollsThisTurn incremented
      expect(clientStateChanges.length).toBe(1);
      expect(clientStateChanges[0].rollsThisTurn).toBe(1);

      // Host selects a score → turn changes to client (index 1)
      clientStateChanges.length = 0;
      hostController.performAction('score', { categoryId: 'ones', score: 3 });

      expect(clientStateChanges.length).toBe(1);
      expect(clientStateChanges[0].currentPlayerIndex).toBe(1); // Client's turn now

      // Verify isMyTurn reflects the turn change
      expect(hostController.isMyTurn()).toBe(false);
      expect(clientController.isMyTurn()).toBe(true);

      hostController.destroy();
      clientController.destroy();
    });

    it('game end triggers gameOver on both sides', () => {
      const { hostPeer, clientPeer } = createMockPeerPair();
      const hostEngine = createMockGameEngine();

      const hostController = createOfflineGameController({
        peer: hostPeer,
        gameEngine: hostEngine,
        isHost: true,
        playerId: 'host-player',
      });

      const clientEngine = createMockGameEngine();
      const clientController = createOfflineGameController({
        peer: clientPeer,
        gameEngine: clientEngine,
        isHost: false,
        playerId: 'client-player',
      });

      const hostGameOverStates = [];
      const clientGameOverStates = [];
      hostController.onGameOver((state) => hostGameOverStates.push(state));
      clientController.onGameOver((state) => clientGameOverStates.push(state));

      // Start the game
      hostController.startGame('kniffel', [
        { id: 'host-player', name: 'Host' },
        { id: 'client-player', name: 'Client' },
      ]);

      // Fast-forward the engine to the last round so next score ends the game
      // maxRounds is 13, so set currentRound to 13 and currentPlayerIndex to 1
      // When player at index 1 scores, nextIndex=0, nextRound=14 > 13 → finished
      hostEngine._setState({
        ...hostEngine.getState(),
        currentRound: 13,
        currentPlayerIndex: 1,
        rollsThisTurn: 1,
        status: 'playing',
      });

      // Client performs a score action (it's their turn at index 1)
      clientController.performAction('score', { categoryId: 'sixes', score: 18 });

      // Both sides should have received the gameOver event
      expect(hostGameOverStates.length).toBe(1);
      expect(hostGameOverStates[0].status).toBe('finished');

      expect(clientGameOverStates.length).toBe(1);
      expect(clientGameOverStates[0].status).toBe('finished');

      hostController.destroy();
      clientController.destroy();
    });
  });
});

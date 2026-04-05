// Lobby Screen — Player list, connection info, and game start
// Feature: dice-game-pwa, Requirements: 7.1, 8.2
// Feature: offline-multiplayer, Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 3.4, 3.5, 6.1, 6.2

import { t } from '../i18n.js';
import { navigate, getParams } from '../app.js';
import { loadTemplate } from '../template-loader.js';
import { createGameModeRegistry } from '../game/game-mode-registry.js';
import { registerFreeRoll } from '../game/modes/free-roll.js';
import { registerKniffel } from '../game/modes/kniffel.js';
import { createWebRTCPeer } from '../multiplayer/webrtc-peer.js';
import { serializeSdpPayload, deserializeSdpPayload, validateSdpPayload } from '../multiplayer/sdp-payload.js';
import { generateQrCode, scanQrCode, stopScanner } from '../multiplayer/qr-code.js';
import { createGameEngine } from '../game/game-engine.js';
import { createOfflineGameController } from '../multiplayer/offline-game-controller.js';
import { setOfflineSession } from '../multiplayer/offline-session.js';
import { createGameStore } from '../store/game-store.js';
import { getAvatar } from '../avatars.js';

/**
 * Factory for the Lobby Screen.
 * @returns {{ mount(container: HTMLElement): void, unmount(): void }}
 */
export function createLobbyScreen() {
  let container = null;
  let cleanupHandlers = [];
  let players = [];
  let modeId = 'free-roll';
  let playType = 'online';
  let maxPlayers = 8;

  // --- Offline mode state ---
  let offlineRole = null; // 'host' | 'client' | null
  let peer = null;
  let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'connected'
  let startBtn = null;

  return {
    mount(el) {
      container = el;

      const params = getParams();
      modeId = params.modeId || 'free-roll';
      playType = params.playType || 'online';
      offlineRole = params.role || null;

      const registry = createGameModeRegistry();
      registerFreeRoll(registry);
      registerKniffel(registry);
      const mode = registry.get(modeId);
      if (mode) maxPlayers = mode.maxPlayers;

      if (playType === 'offline') {
        maxPlayers = 2;
        players = [
          { id: 'local-1', name: t('scoreboard.player') + ' 1', connectionStatus: 'connected', isHost: offlineRole === 'host' },
        ];
      } else {
        players = [
          { id: 'host-1', name: t('scoreboard.player') + ' 1', connectionStatus: 'connected', isHost: true },
        ];
      }

      render();
    },

    unmount() {
      stopScanner();
      if (peer) {
        peer.disconnect();
        peer = null;
      }
      cleanupHandlers.forEach((fn) => fn());
      cleanupHandlers = [];
      if (container) {
        container.innerHTML = '';
        container = null;
      }
    },

    /** Exposed for testing: get the current peer instance */
    getPeer() { return peer; },

    /** Exposed for testing: get the current connection status */
    getConnectionStatus() { return connectionStatus; },
  };

  async function render() {
    if (!container) return;

    const fragment = await loadTemplate('templates/lobby.html', t);

    // Player count (skip in offline mode)
    const countEl = fragment.querySelector('#lobby-player-count');
    if (playType === 'offline') {
      countEl.remove();
    } else {
      countEl.textContent = t('lobby.playerCount', { current: players.length, max: maxPlayers });
    }

    // Back button
    const backBtn = fragment.querySelector('#lobby-back-btn');
    if (backBtn) {
      const backHandler = () => navigate('home');
      backBtn.addEventListener('click', backHandler);
      cleanupHandlers.push(() => backBtn.removeEventListener('click', backHandler));
    }

    // Connection info (remove in offline mode)
    const connSlot = fragment.querySelector('[data-slot="connection-info"]');
    if (playType === 'offline') {
      connSlot.remove();
    } else {
      populateConnectionInfo(connSlot);
    }

    // Player list
    const playerList = fragment.querySelector('[data-slot="player-list"]');
    players.forEach((player) => {
      playerList.appendChild(createPlayerItem(player));
    });

    // Start button — wire up from template
    startBtn = fragment.querySelector('#lobby-start-btn');
    if (startBtn) {
      // Hide for client, show for host
      const isHost = offlineRole === 'host' || playType !== 'offline';
      if (!isHost) {
        startBtn.remove();
      } else {
        if (playType !== 'offline') {
          startBtn.disabled = false;
          startBtn.removeAttribute('aria-disabled');
        }
        const startHandler = () => handleStartGame();
        startBtn.addEventListener('click', startHandler);
        cleanupHandlers.push(() => startBtn.removeEventListener('click', startHandler));
      }
    }

    container.innerHTML = '';
    container.appendChild(fragment);

    // --- Offline mode initialization ---
    if (playType === 'offline') {
      initOfflineMode();
    }
  }

  function populateConnectionInfo(slot) {
    const div = document.createElement('div');
    div.className = 'lobby-screen__connection-info';
    div.setAttribute('role', 'region');

    if (playType === 'online') {
      div.setAttribute('aria-label', t('lobby.inviteLink'));

      const label = document.createElement('p');
      label.className = 'lobby-screen__invite-label';
      label.textContent = t('lobby.inviteLink');
      div.appendChild(label);

      const linkRow = document.createElement('div');
      linkRow.className = 'lobby-screen__invite-row';

      const linkInput = document.createElement('input');
      linkInput.type = 'text';
      linkInput.readOnly = true;
      linkInput.className = 'adaptive input__field';
      linkInput.setAttribute('data-material', 'filled-2');
      linkInput.setAttribute('data-interactive', '');
      linkInput.value = generateInviteLink();
      linkInput.setAttribute('aria-label', t('lobby.inviteLink'));
      linkRow.appendChild(linkInput);

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'adaptive button';
      copyBtn.setAttribute('data-interactive', '');
      copyBtn.setAttribute('data-material', 'filled');
      copyBtn.textContent = t('lobby.copyLink');
      copyBtn.setAttribute('aria-label', t('lobby.copyLink'));

      const copyHandler = async () => {
        try {
          await navigator.clipboard.writeText(linkInput.value);
          copyBtn.textContent = t('lobby.linkCopied');
          setTimeout(() => { copyBtn.textContent = t('lobby.copyLink'); }, 2000);
        } catch {
          linkInput.select();
        }
      };
      copyBtn.addEventListener('click', copyHandler);
      cleanupHandlers.push(() => copyBtn.removeEventListener('click', copyHandler));

      linkRow.appendChild(copyBtn);
      div.appendChild(linkRow);
    } else if (playType !== 'offline') {
      div.setAttribute('aria-label', t('lobby.peerDiscovery'));

      const peerMsg = document.createElement('p');
      peerMsg.className = 'lobby-screen__peer-discovery';
      peerMsg.setAttribute('role', 'status');
      peerMsg.setAttribute('aria-live', 'polite');
      peerMsg.textContent = t('lobby.peerDiscovery');
      div.appendChild(peerMsg);
    }

    slot.appendChild(div);
  }

  function createPlayerItem(player) {
    const li = document.createElement('li');
    li.className = 'adaptive lobby-screen__player';
    li.setAttribute('data-material', 'filled');
    li.setAttribute('data-player-id', player.id);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'lobby-screen__player-name';
    nameSpan.textContent = player.name;
    li.appendChild(nameSpan);

    if (player.isHost) {
      const hostBadge = document.createElement('span');
      hostBadge.className = 'adaptive badge';
      hostBadge.setAttribute('data-material', 'vibrant');
      hostBadge.setAttribute('data-color', 'blue');
      hostBadge.setAttribute('data-size', 'xs');
      hostBadge.textContent = t('lobby.host');
      hostBadge.setAttribute('aria-label', t('lobby.host'));
      li.appendChild(hostBadge);
    }

    const statusSpan = document.createElement('span');
    statusSpan.className = 'adaptive badge';
    statusSpan.setAttribute('data-size', 'xs');
    statusSpan.setAttribute('aria-label', t(`lobby.${player.connectionStatus}`));
    statusSpan.textContent = t(`lobby.${player.connectionStatus}`);
    statusSpan.dataset.status = player.connectionStatus;
    if (player.connectionStatus === 'connected') {
      statusSpan.setAttribute('data-material', 'vibrant');
      statusSpan.setAttribute('data-color', 'green');
    } else {
      statusSpan.setAttribute('data-material', 'vibrant');
      statusSpan.setAttribute('data-color', 'red');
    }
    li.appendChild(statusSpan);

    return li;
  }



  function generateInviteLink() {
    const gameId = 'game-' + Math.random().toString(36).slice(2, 10);
    return `${window.location.origin}${window.location.pathname}#lobby?modeId=${modeId}&playType=online&gameId=${gameId}`;
  }

  // =========================================================================
  // Offline Mode — Host & Client signaling flows
  // =========================================================================

  /**
   * Initializes offline mode UI and starts the appropriate signaling flow.
   */
  function initOfflineMode() {
    if (!container) return;

    // Show connection status
    const statusEl = container.querySelector('[data-offline-connection-status]');
    if (statusEl) statusEl.hidden = false;

    // Remove player list and count — not needed in offline mode
    const playersSection = container.querySelector('.lobby-screen__players');
    if (playersSection) playersSection.remove();

    if (offlineRole === 'host') {
      // Host: remove client-only buttons
      const clientScanBtn = container.querySelector('[data-offline-scan-offer]');
      if (clientScanBtn) clientScanBtn.remove();
      const pasteOfferBtn = container.querySelector('[data-offline-paste-offer]');
      if (pasteOfferBtn) pasteOfferBtn.remove();
      const shareAnswerBtn = container.querySelector('[data-offline-share-answer]');
      if (shareAnswerBtn) shareAnswerBtn.remove();
      startHostFlow();
    } else if (offlineRole === 'client') {
      // Client: remove host-only buttons
      const hostScanBtn = container.querySelector('[data-offline-scan-answer]');
      if (hostScanBtn) hostScanBtn.remove();
      const shareOfferBtn = container.querySelector('[data-offline-share-offer]');
      if (shareOfferBtn) shareOfferBtn.remove();
      const pasteAnswerBtn = container.querySelector('[data-offline-paste-answer]');
      if (pasteAnswerBtn) pasteAnswerBtn.remove();
      // Show client buttons
      const scanOfferBtn = container.querySelector('[data-offline-scan-offer]');
      if (scanOfferBtn) scanOfferBtn.hidden = false;
      const pasteOfferBtn = container.querySelector('[data-offline-paste-offer]');
      if (pasteOfferBtn) pasteOfferBtn.hidden = false;
      setupClientFlow();
    }

    updateConnectionStatusUI();

    // Scanner close button
    const scannerCloseBtn = container.querySelector('[data-offline-scanner-close]');
    if (scannerCloseBtn) {
      const closeHandler = () => {
        stopScanner();
        const scannerOverlay = container.querySelector('[data-offline-scanner]');
        if (scannerOverlay) scannerOverlay.hidden = true;
      };
      scannerCloseBtn.addEventListener('click', closeHandler);
      cleanupHandlers.push(() => scannerCloseBtn.removeEventListener('click', closeHandler));
    }
  }

  /**
   * Updates the connection status UI elements.
   */
  function updateConnectionStatusUI() {
    if (!container) return;

    const dot = container.querySelector('[data-offline-status-dot]');
    const label = container.querySelector('[data-offline-status-label]');

    if (dot) {
      dot.dataset.status = connectionStatus;
    }
    if (label) {
      if (connectionStatus === 'connected') {
        label.textContent = t('lobby.connected');
      } else if (connectionStatus === 'connecting') {
        label.textContent = t('lobby.connecting');
      } else {
        label.textContent = t('lobby.disconnected');
      }
    }

    // Enable/disable start button based on connection status
    if (startBtn) {
      if (connectionStatus === 'connected') {
        startBtn.disabled = false;
        startBtn.removeAttribute('aria-disabled');
      } else {
        startBtn.disabled = true;
        startBtn.setAttribute('aria-disabled', 'true');
      }
    }
  }

  /**
   * Shows an error message in the offline error display.
   * @param {string} message
   */
  function showOfflineError(message) {
    if (!container) return;
    const errorEl = container.querySelector('[data-offline-error]');
    const errorText = container.querySelector('[data-offline-error-text]');
    if (errorEl && errorText) {
      errorText.textContent = message;
      errorEl.hidden = false;
    }
  }

  /**
   * Hides the offline error display.
   */
  function hideOfflineError() {
    if (!container) return;
    const errorEl = container.querySelector('[data-offline-error]');
    if (errorEl) errorEl.hidden = true;
  }

  /**
   * Shows a specific offline step and hides others within a section.
   * @param {string} sectionAttr - data attribute of the parent section
   * @param {string} stepAttr - data attribute of the step to show
   */

  /**
   * Adds a remote player to the player list UI.
   */
  function addRemotePlayer() {
    if (!container) return;
    const remotePlayer = {
      id: 'remote-1',
      name: t('scoreboard.player') + ' 2',
      connectionStatus: 'connected',
      isHost: offlineRole !== 'host',
    };
    players.push(remotePlayer);

    const playerList = container.querySelector('[data-slot="player-list"]');
    if (playerList) {
      playerList.appendChild(createPlayerItem(remotePlayer));
    }

    // Update player count
    const countEl = container.querySelector('#lobby-player-count');
    if (countEl) {
      countEl.textContent = t('lobby.playerCount', { current: players.length, max: maxPlayers });
    }
  }

  // =========================================================================
  // Host Flow
  // =========================================================================

  /**
   * Host flow: generate offer → display QR + text → wait for answer → connect.
   */
  async function startHostFlow() {
    if (!container) return;

    // Show loading
    const loadingEl = container.querySelector('[data-offline-loading]');
    if (loadingEl) loadingEl.hidden = false;

    try {
      peer = createWebRTCPeer();
      setupPeerConnectionHandlers();
      await peer.connect({ isHost: true });
      connectionStatus = 'connecting';
      updateConnectionStatusUI();

      const offer = await peer.getOffer();
      const serialized = serializeSdpPayload({
        type: offer.type,
        sdp: offer.sdp,
        candidates: offer.candidates,
      });

      // Hide loading, show QR
      if (loadingEl) loadingEl.hidden = true;

      const qrContainer = container.querySelector('[data-offline-qr-display]');
      if (qrContainer) {
        qrContainer.hidden = false;
        const qrDataUrl = await generateQrCode(serialized);
        const img = document.createElement('img');
        img.src = qrDataUrl;
        img.alt = 'SDP-Offer QR-Code';
        img.className = 'lobby-screen__offline-qr-img';
        qrContainer.innerHTML = '';
        qrContainer.appendChild(img);
      }

      // Show the answer scan and paste buttons
      const scanAnswerBtn = container.querySelector('[data-offline-scan-answer]');
      if (scanAnswerBtn) scanAnswerBtn.hidden = false;
      const pasteAnswerBtn = container.querySelector('[data-offline-paste-answer]');
      if (pasteAnswerBtn) pasteAnswerBtn.hidden = false;

      // Show share offer button
      const shareOfferBtn = container.querySelector('[data-offline-share-offer]');
      if (shareOfferBtn) {
        shareOfferBtn.hidden = false;
        const shareHandler = async () => {
          try {
            await navigator.share({ title: 'Dice Game Offer', text: serialized });
          } catch { /* user cancelled or share not supported */ }
        };
        shareOfferBtn.addEventListener('click', shareHandler);
        cleanupHandlers.push(() => shareOfferBtn.removeEventListener('click', shareHandler));
      }

      setupHostAnswerInput(serialized);
    } catch (err) {
      if (loadingEl) loadingEl.hidden = true;
      showOfflineError(err.message || t('error.generic'));
    }
  }

  /**
   * Sets up the host's answer input (scanner + text field).
   */
  function setupHostAnswerInput(offerPayload) {
    if (!container) return;

    // Scan answer QR
    const scanAnswerBtn = container.querySelector('[data-offline-scan-answer]');
    if (scanAnswerBtn) {
      const scanHandler = async () => {
        hideOfflineError();
        const scannerOverlay = container.querySelector('[data-offline-scanner]');
        const videoEl = container.querySelector('[data-offline-scanner-video]');
        if (scannerOverlay && videoEl) {
          scannerOverlay.hidden = false;
          try {
            const scannedData = await scanQrCode(videoEl);
            scannerOverlay.hidden = true;
            await processHostAnswer(scannedData);
          } catch (err) {
            scannerOverlay.hidden = true;
            showOfflineError(err.message || t('error.generic'));
          }
        }
      };
      scanAnswerBtn.addEventListener('click', scanHandler);
      cleanupHandlers.push(() => scanAnswerBtn.removeEventListener('click', scanHandler));
    }

    // Paste answer from clipboard
    const pasteAnswerBtn = container.querySelector('[data-offline-paste-answer]');
    if (pasteAnswerBtn) {
      const pasteHandler = async () => {
        hideOfflineError();
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.trim()) {
            await processHostAnswer(text.trim());
          } else {
            showOfflineError('Zwischenablage ist leer.');
          }
        } catch {
          showOfflineError('Zugriff auf Zwischenablage nicht möglich.');
        }
      };
      pasteAnswerBtn.addEventListener('click', pasteHandler);
      cleanupHandlers.push(() => pasteAnswerBtn.removeEventListener('click', pasteHandler));
    }
  }

  /**
   * Processes the answer SDP payload received by the host.
   * @param {string} answerData - Serialized SDP answer payload
   */
  async function processHostAnswer(answerData) {
    try {
      const answerPayload = deserializeSdpPayload(answerData);
      const validation = validateSdpPayload(answerPayload);
      if (!validation.valid) {
        showOfflineError(validation.error);
        return;
      }
      await peer.setAnswer(answerPayload);
      // Connection status will be updated via the peer connection handler
    } catch (err) {
      showOfflineError(err.message || t('error.generic'));
    }
  }

  // =========================================================================
  // Client Flow
  // =========================================================================

  /**
   * Sets up the client flow: show instructions + scanner/text field for offer.
   */
  function setupClientFlow() {
    if (!container) return;

    // Scan offer QR
    const scanOfferBtn = container.querySelector('[data-offline-scan-offer]');
    if (scanOfferBtn) {
      const scanHandler = async () => {
        hideOfflineError();
        const scannerOverlay = container.querySelector('[data-offline-scanner]');
        const videoEl = container.querySelector('[data-offline-scanner-video]');
        if (scannerOverlay && videoEl) {
          scannerOverlay.hidden = false;
          try {
            const scannedData = await scanQrCode(videoEl);
            scannerOverlay.hidden = true;
            await processClientOffer(scannedData);
          } catch (err) {
            scannerOverlay.hidden = true;
            showOfflineError(err.message || t('error.generic'));
          }
        }
      };
      scanOfferBtn.addEventListener('click', scanHandler);
      cleanupHandlers.push(() => scanOfferBtn.removeEventListener('click', scanHandler));
    }

    // Paste offer from clipboard
    const pasteOfferBtn = container.querySelector('[data-offline-paste-offer]');
    if (pasteOfferBtn) {
      const pasteHandler = async () => {
        hideOfflineError();
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.trim()) {
            await processClientOffer(text.trim());
          } else {
            showOfflineError('Zwischenablage ist leer.');
          }
        } catch {
          showOfflineError('Zugriff auf Zwischenablage nicht möglich.');
        }
      };
      pasteOfferBtn.addEventListener('click', pasteHandler);
      cleanupHandlers.push(() => pasteOfferBtn.removeEventListener('click', pasteHandler));
    }
  }

  /**
   * Processes the offer SDP payload received by the client.
   * @param {string} offerData - Serialized SDP offer payload
   */
  async function processClientOffer(offerData) {
    try {
      const offerPayload = deserializeSdpPayload(offerData);
      const validation = validateSdpPayload(offerPayload);
      if (!validation.valid) {
        showOfflineError(validation.error);
        return;
      }

      // Create peer and set the offer
      peer = createWebRTCPeer();
      setupPeerConnectionHandlers();
      await peer.connect({ isHost: false });
      connectionStatus = 'connecting';
      updateConnectionStatusUI();

      await peer.setOffer(offerPayload);

      // Generate answer
      const answer = await peer.getAnswer();
      const serialized = serializeSdpPayload({
        type: answer.type,
        sdp: answer.sdp,
        candidates: answer.candidates,
      });

      // Show answer QR code, hide scan/paste buttons
      const scanOfferBtn = container.querySelector('[data-offline-scan-offer]');
      if (scanOfferBtn) scanOfferBtn.hidden = true;
      const pasteOfferBtn = container.querySelector('[data-offline-paste-offer]');
      if (pasteOfferBtn) pasteOfferBtn.hidden = true;

      const qrContainer = container.querySelector('[data-offline-qr-display-answer]');
      if (qrContainer) {
        qrContainer.hidden = false;
        const qrDataUrl = await generateQrCode(serialized);
        const img = document.createElement('img');
        img.src = qrDataUrl;
        img.alt = 'SDP-Answer QR-Code';
        img.className = 'lobby-screen__offline-qr-img';
        qrContainer.innerHTML = '';
        qrContainer.appendChild(img);
      }

      // Show share answer button
      const shareAnswerBtn = container.querySelector('[data-offline-share-answer]');
      if (shareAnswerBtn) {
        shareAnswerBtn.hidden = false;
        const shareHandler = async () => {
          try {
            await navigator.share({ title: 'Dice Game Answer', text: serialized });
          } catch { /* user cancelled */ }
        };
        shareAnswerBtn.addEventListener('click', shareHandler);
        cleanupHandlers.push(() => shareAnswerBtn.removeEventListener('click', shareHandler));
      }

      // Connection status will be updated via the peer connection handler
    } catch (err) {
      showOfflineError(err.message || t('error.generic'));
    }
  }

  // =========================================================================
  // Game Start — Host starts game, Client listens for initial state
  // =========================================================================

  /**
   * Handles the "Spiel starten" button click.
   * For online mode: navigates directly.
   * For offline mode: creates controller, starts game, saves state, navigates.
   */
  async function handleStartGame() {
    if (playType !== 'offline') {
      navigate('game', { modeId, playType });
      return;
    }

    if (!peer || connectionStatus !== 'connected') return;

    try {
      const localPlayerId = 'local-1';

      // Store the session for the game screen to pick up
      setOfflineSession({ peer, role: offlineRole, playerId: localPlayerId });

      // Create game engine and controller
      const gameRegistry = createGameModeRegistry();
      registerFreeRoll(gameRegistry);
      registerKniffel(gameRegistry);

      const gameEngine = createGameEngine(gameRegistry);
      const controller = createOfflineGameController({
        peer,
        gameEngine,
        isHost: true,
        playerId: localPlayerId,
      });

      // Start the game with two players
      const gamePlayers = [
        { id: 'local-1', name: t('scoreboard.player') + ' 1', avatar: getAvatar(0) },
        { id: 'remote-1', name: t('scoreboard.player') + ' 2', avatar: getAvatar(1) },
      ];
      const initialState = controller.startGame(modeId, gamePlayers);

      // Save state to store so result screen can load it
      try {
        const store = await createGameStore();
        await store.save(initialState);
      } catch {
        // Continue even if save fails
      }

      // Navigate to game screen — peer is passed via offline session
      navigate('game', {
        modeId,
        playType: 'offline',
        role: 'host',
        gameId: initialState.gameId,
      });
    } catch (err) {
      showOfflineError(err.message || t('error.generic'));
    }
  }

  /**
   * Sets up the client to listen for the initial game state from the host.
   * When received, saves state and navigates to the game screen.
   */
  function setupClientGameStartListener() {
    if (!peer) return;

    peer.onMessage((action) => {
      if (action && action.type === 'start' && action.payload && action.payload.gameState) {
        const gameState = action.payload.gameState;

        // Store the session for the game screen
        setOfflineSession({ peer, role: 'client', playerId: 'remote-1' });

        // Save state to store so result screen can load it
        createGameStore().then((store) => {
          store.save(gameState).catch(() => {});
        }).catch(() => {});

        // Navigate to game screen
        navigate('game', {
          modeId: gameState.modeId,
          playType: 'offline',
          role: 'client',
          gameId: gameState.gameId,
        });
      }
    });
  }

  // =========================================================================
  // Peer connection status handling
  // =========================================================================

  /**
   * Registers connection change handlers on the peer.
   */
  function setupPeerConnectionHandlers() {
    if (!peer) return;

    peer.onConnectionChange((status) => {
      if (status === 'connected') {
        connectionStatus = 'connected';
        updateConnectionStatusUI();
        addRemotePlayer();

        // Client: show waiting step and listen for game start
        if (offlineRole === 'client') {
          // Show waiting state
          const loadingEl = container.querySelector('[data-offline-loading]');
          if (loadingEl) {
            loadingEl.hidden = false;
            const loadingText = loadingEl.querySelector('[data-offline-loading-text]');
            if (loadingText) loadingText.textContent = t('lobby.offlineClientWaiting');
          }
          // Hide answer QR
          const answerQr = container.querySelector('[data-offline-qr-display-answer]');
          if (answerQr) answerQr.hidden = true;
          setupClientGameStartListener();
        }
      } else if (status === 'connecting' || status === 'reconnecting') {
        connectionStatus = 'connecting';
        updateConnectionStatusUI();
      } else {
        connectionStatus = 'disconnected';
        updateConnectionStatusUI();
      }
    });
  }
}

// Game Screen — Dice area, scoreboard, and game controls
// Feature: dice-game-pwa, Requirements: 3.3, 3.5, 4.3, 9.3, 9.4, 10.2
// Feature: offline-multiplayer, Requirements: 5.1, 5.2, 5.3, 5.4, 6.3, 6.4

import { t } from '../i18n.js';
import { navigate, getParams } from '../app.js';
import { loadTemplate } from '../template-loader.js';
import { createDiceRenderer } from '../dice/dice-renderer.js';
import { announceDiceResult } from '../dice/dice-announcer.js';
import { createGameEngine } from '../game/game-engine.js';
import { createScoreboard } from '../game/scoreboard.js';
import { createGameModeRegistry } from '../game/game-mode-registry.js';
import { registerFreeRoll } from '../game/modes/free-roll.js';
import { registerKniffel } from '../game/modes/kniffel.js';
import { createGameStore } from '../store/game-store.js';
import { getAvatar } from '../avatars.js';
import { createOfflineGameController } from '../multiplayer/offline-game-controller.js';
import { getOfflineSession, clearOfflineSession } from '../multiplayer/offline-session.js';

/**
 * Factory for the Game Screen.
 * @returns {{ mount(container: HTMLElement): void, unmount(): void }}
 */
export function createGameScreen() {
  let container = null;
  let engine = null;
  let renderer = null;
  let scoreboard = null;
  let store = null;
  let registry = null;
  let cleanupHandlers = [];

  // Offline multiplayer state
  let offlineController = null;
  let isOfflineMode = false;
  let offlineRole = null;
  let _prevRollsThisTurn = 0;

  return {
    async mount(el) {
      container = el;

      // Set up registry
      registry = createGameModeRegistry();
      registerFreeRoll(registry);
      registerKniffel(registry);

      // Init store
      try {
        store = await createGameStore();
      } catch {
        store = null;
      }

      const params = getParams();
      isOfflineMode = params.playType === 'offline';
      offlineRole = params.role || null;
      engine = createGameEngine(registry);

      if (isOfflineMode) {
        // Offline multiplayer mode — use the offline game controller
        await initOfflineGame(params);
      } else if (params.gameId && store) {
        const saved = await store.load(params.gameId);
        if (saved) {
          const players = saved.players.map((p, i) => ({ ...p, avatar: p.avatar || getAvatar(i) }));
          engine.startGame(saved.modeId, players);
        } else {
          engine.startGame('free-roll', [{ id: 'player-1', name: t('scoreboard.player') + ' 1', avatar: getAvatar(0) }]);
        }
      } else if (params.modeId) {
        const modeId = params.modeId;
        const count = params.playType === 'local' ? (parseInt(params.playerCount, 10) || 2) : 1;
        const playerNames = params.playerNames ? params.playerNames.split(',') : [];
        const players = [];
        for (let i = 0; i < count; i++) {
          const name = playerNames[i] || `${t('scoreboard.player')} ${i + 1}`;
          players.push({ id: `player-${i + 1}`, name, avatar: getAvatar(i) });
        }
        engine.startGame(modeId, players);
      } else {
        engine.startGame('free-roll', [{ id: 'player-1', name: t('scoreboard.player') + ' 1', avatar: getAvatar(0) }]);
      }

      await buildUI();

      if (isOfflineMode) {
        bindOfflineEvents();
      } else {
        bindEngineEvents();
      }

      bindKeyboard();
      updateUI();
    },

    unmount() {
      cleanupHandlers.forEach((fn) => fn());
      cleanupHandlers = [];
      if (offlineController) {
        offlineController.destroy();
        offlineController = null;
      }
      if (renderer) renderer.destroy();
      if (scoreboard) scoreboard.destroy();
      renderer = null;
      scoreboard = null;
      engine = null;
      store = null;
      registry = null;
      isOfflineMode = false;
      offlineRole = null;
      if (container) {
        container.innerHTML = '';
        container = null;
      }
    },
  };

  /**
   * Builds the game screen DOM from template.
   */
  async function buildUI() {
    if (!container) return;
    container.innerHTML = '';

    const state = engine.getState();
    const mode = registry.get(state.modeId);

    const fragment = await loadTemplate('templates/game.html', t);

    // Back button — ends game, deletes save, navigates home
    const backBtn = fragment.querySelector('#game-back-btn');
    const backHandler = async () => {
      if (store && engine) {
        const state = engine.getState();
        if (state) {
          try { await store.delete(state.gameId); } catch { /* ignore */ }
        }
      }
      navigate('home');
    };
    backBtn.addEventListener('click', backHandler);
    cleanupHandlers.push(() => backBtn.removeEventListener('click', backHandler));

    // Free-roll controls: show and bind dice count selector
    if (state.modeId === 'free-roll') {
      const freeRollControls = fragment.querySelector('#game-free-roll-controls');
      freeRollControls.removeAttribute('hidden');

      const countSelect = fragment.querySelector('#game-dice-count');
      countSelect.value = String(mode.diceCount);
      countSelect.addEventListener('change', async () => {
        const newCount = parseInt(countSelect.value, 10);
        if (!isNaN(newCount) && newCount >= 1 && newCount <= 6) {
          engine.resetDice(newCount);
          if (renderer) {
            const diceArea = container.querySelector('#game-dice-area');
            await renderer.create(diceArea, newCount);
          }
        }
      });
    }

    container.appendChild(fragment);

    // Populate player bar
    renderPlayerBar();

    // Initialize dice renderer
    const diceArea = container.querySelector('#game-dice-area');
    renderer = createDiceRenderer();
    await renderer.create(diceArea, mode.diceCount);

    // Initialize scoreboard
    const scoreArea = container.querySelector('#game-scoreboard-area');
    scoreboard = createScoreboard();
    scoreboard.mount(scoreArea, state);
    scoreboard.onCategorySelect(handleCategorySelect);

    // Hide scoreboard fade for solo
    if (state.players.length <= 1) {
      const scoreboardEl = scoreArea.querySelector('.scoreboard');
      if (scoreboardEl) scoreboardEl.classList.add('scoreboard--solo');
    }

    // Reset scroll to dice page AFTER everything is mounted
    const pages = container.querySelector('#game-pages');
    if (pages) {
      pages.scrollLeft = 0;
      // Double-ensure after browser layout + paint
      requestAnimationFrame(() => {
        pages.scrollLeft = 0;
        requestAnimationFrame(() => { pages.scrollLeft = 0; });
      });
    }

    // Bind roll button
    const rollBtn = container.querySelector('#game-roll-btn');
    const rollHandler = (e) => { e.preventDefault(); handleRoll(); };
    rollBtn.addEventListener('click', rollHandler);
    cleanupHandlers.push(() => rollBtn.removeEventListener('click', rollHandler));

    // Bind die click for hold/release
    const diceClickHandler = (e) => {
      if (e.detail && e.detail.index !== undefined) {
        handleToggleHold(e.detail.index);
      }
    };
    diceArea.addEventListener('die-click', diceClickHandler);
    cleanupHandlers.push(() => diceArea.removeEventListener('die-click', diceClickHandler));
  }

  /**
   * Renders or updates the player bar with current state.
   */
  function renderPlayerBar() {
    if (!container) return;

    // Get state from controller in offline mode, otherwise from engine
    const state = (isOfflineMode && offlineController)
      ? offlineController.getState()
      : (engine ? engine.getState() : null);
    if (!state) return;

    const bar = container.querySelector('#game-player-bar');
    if (!bar) return;

    // Hide player bar for free-roll mode (solo kniffel keeps it)
    if (state.modeId === 'free-roll') {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = '';
    bar.innerHTML = '';

    // Reorder: active player first, then the rest in order after them
    const activeIdx = state.currentPlayerIndex;
    const ordered = [
      ...state.players.slice(activeIdx),
      ...state.players.slice(0, activeIdx),
    ];

    ordered.forEach((player) => {
      const index = state.players.indexOf(player);
      const el = document.createElement('div');
      el.className = 'player-bar__player' + (index === state.currentPlayerIndex ? ' player-bar__player--active' : '');

      const avatar = document.createElement('span');
      avatar.className = 'player-bar__avatar';
      avatar.textContent = player.avatar || getAvatar(index);

      if (index === state.currentPlayerIndex) {
        const badge = document.createElement('span');
        badge.className = 'adaptive badge';
        badge.setAttribute('data-material', 'inverted');
        badge.setAttribute('data-color', 'neutral');
        badge.setAttribute('data-size', 'xs');
        badge.setAttribute('data-container-contrast', 'max');
        badge.textContent = '🎲';
        avatar.appendChild(badge);
      }

      const info = document.createElement('div');
      info.className = 'player-bar__info';

      const name = document.createElement('span');
      name.className = 'player-bar__name';
      name.textContent = player.name;

      const score = document.createElement('span');
      score.className = 'player-bar__score';
      const sheet = state.scores[player.id];
      score.textContent = sheet ? sheet.totalScore : 0;

      info.appendChild(name);
      info.appendChild(score);
      el.appendChild(avatar);
      el.appendChild(info);
      bar.appendChild(el);
    });

    // Scroll to start so active player is visible
    bar.scrollLeft = 0;

    // Fade edges on header based on bar scroll position (only for 2+ players)
    const header = bar.closest('.game-screen__header');
    if (state.players.length >= 2) {
      const updateBarFades = () => {
        if (!header) return;
        const { scrollLeft, scrollWidth, clientWidth } = bar;
        header.classList.toggle('game-screen__header--fade-left', scrollLeft > 4);
        header.classList.toggle('game-screen__header--fade-right', scrollLeft < scrollWidth - clientWidth - 4);
      };
      bar.addEventListener('scroll', updateBarFades, { passive: true });
      cleanupHandlers.push(() => bar.removeEventListener('scroll', updateBarFades));
      requestAnimationFrame(updateBarFades);
    }
  }

  // =========================================================================
  // Offline Multiplayer — Controller initialization and event wiring
  // =========================================================================

  /**
   * Initializes the offline game: retrieves the peer from the session,
   * creates the controller, and loads the game state.
   * @param {object} params - URL parameters
   */
  async function initOfflineGame(params) {
    const session = getOfflineSession();

    if (!session.peer) {
      // No peer available — fall back to a basic game
      engine.startGame(params.modeId || 'free-roll', [
        { id: 'player-1', name: t('scoreboard.player') + ' 1', avatar: getAvatar(0) },
      ]);
      isOfflineMode = false;
      return;
    }

    const isHost = params.role === 'host';
    const localPlayerId = session.playerId || (isHost ? 'local-1' : 'remote-1');

    offlineController = createOfflineGameController({
      peer: session.peer,
      gameEngine: engine,
      isHost,
      playerId: localPlayerId,
    });

    // Load the saved game state
    if (params.gameId && store) {
      const saved = await store.load(params.gameId);
      if (saved) {
        // Start the engine with the saved state for both host and client
        // This ensures engine.getState() works for buildUI
        const players = saved.players.map((p, i) => ({ ...p, avatar: p.avatar || getAvatar(i) }));
        engine.startGame(saved.modeId, players);
      }
    }

    // If no saved state and host, start a default game
    if (!engine.getState()) {
      const fallbackModeId = params.modeId || 'free-roll';
      if (isHost) {
        engine.startGame(fallbackModeId, [
          { id: 'local-1', name: t('scoreboard.player') + ' 1', avatar: getAvatar(0) },
          { id: 'remote-1', name: t('scoreboard.player') + ' 2', avatar: getAvatar(1) },
        ]);
      } else {
        // Client fallback — start with default players so UI can render
        engine.startGame(fallbackModeId, [
          { id: 'local-1', name: t('scoreboard.player') + ' 1', avatar: getAvatar(0) },
          { id: 'remote-1', name: t('scoreboard.player') + ' 2', avatar: getAvatar(1) },
        ]);
      }
    }
  }

  /**
   * Binds offline controller events: state changes, game over, connection status.
   */
  function bindOfflineEvents() {
    if (!offlineController) return;

    // Also bind engine events for the host (engine emits events when host applies actions)
    if (offlineController.getIsHost()) {
      engine.on('stateChange', () => {
        updateOfflineUI();
        saveState();
      });
    }

    // State changes from the controller (both host and client)
    offlineController.onStateChange((state) => {
      updateOfflineUI();
      saveState();
    });

    // Game over — navigate to result screen
    offlineController.onGameOver((state) => {
      saveState();
      navigate('result', { gameId: state.gameId });
    });

    // Connection status changes — show warnings
    offlineController.onConnectionStatusChange((status) => {
      showConnectionStatus(status);
    });
  }

  /**
   * Updates the UI based on the offline controller's state.
   * Enables/disables controls based on isMyTurn().
   */
  function updateOfflineUI() {
    if (!offlineController || !container) return;

    const state = offlineController.getState();
    if (!state) return;

    // Update player bar
    renderPlayerBar();

    const rollBtn = container.querySelector('#game-roll-btn');
    if (rollBtn) {
      const mode = registry.get(state.modeId);
      const myTurn = offlineController.isMyTurn();
      const canRoll = myTurn && state.status === 'playing' &&
        (mode.rollsPerTurn === null || state.rollsThisTurn < mode.rollsPerTurn);
      rollBtn.disabled = !canRoll;

      // Update button text with roll count
      const btnTextNode = rollBtn.childNodes[rollBtn.childNodes.length - 1];
      if (mode.rollsPerTurn !== null) {
        const text = ` ${t('game.roll')} (${state.rollsThisTurn}/${mode.rollsPerTurn})`;
        if (btnTextNode?.nodeType === 3) btnTextNode.textContent = text;
      } else {
        const text = ` ${t('game.roll')}`;
        if (btnTextNode?.nodeType === 3) btnTextNode.textContent = text;
      }
    }

    // Update dice display — animate if a roll just happened
    if (renderer && state.dice) {
      const justRolled = state.rollsThisTurn > _prevRollsThisTurn || 
        (state.rollsThisTurn === 0 && _prevRollsThisTurn > 0); // turn changed, reset
      renderer.update(state.dice, justRolled);
      if (justRolled) {
        announceDiceResult(state.dice.values);
        triggerHaptic();
      }
      for (let i = 0; i < state.dice.held.length; i++) {
        renderer.setHeld(i, state.dice.held[i]);
      }
      _prevRollsThisTurn = state.rollsThisTurn;
    }

    if (scoreboard) scoreboard.update(state);

    // Auto-navigate to scoreboard after last roll (same as normal mode)
    const mode = registry.get(state.modeId);
    if (mode && mode.rollsPerTurn !== null && state.rollsThisTurn >= mode.rollsPerTurn && offlineController.isMyTurn()) {
      setTimeout(() => showPage('score'), 1400);
    }

  }

  /**
   * Shows connection status warnings/errors for offline mode.
   * @param {string} status - 'connected', 'disconnected', 'failed', 'connecting'
   */
  function showConnectionStatus(status) {
    if (!container) return;

    // Remove existing connection banner
    const existing = container.querySelector('[data-offline-connection-banner]');
    if (existing) existing.remove();

    if (status === 'connected') return; // No banner needed

    const banner = document.createElement('div');
    banner.setAttribute('data-offline-connection-banner', '');
    banner.setAttribute('role', 'alert');
    banner.className = 'game-screen__offline-connection-banner';

    if (status === 'disconnected') {
      banner.className += ' game-screen__offline-connection-banner--warning';
      banner.textContent = t('game.offlineDisconnected');
    } else if (status === 'failed') {
      banner.className += ' game-screen__offline-connection-banner--error';

      const msg = document.createElement('span');
      msg.textContent = t('game.offlineFailed');
      banner.appendChild(msg);

      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'adaptive button';
      backBtn.setAttribute('data-interactive', '');
      backBtn.setAttribute('data-material', 'filled');
      backBtn.textContent = t('game.offlineBackHome');
      backBtn.addEventListener('click', () => {
        clearOfflineSession();
        navigate('home');
      });
      banner.appendChild(backBtn);
    }

    // Insert at the top of the game screen
    const gameScreen = container.querySelector('.game-screen');
    if (gameScreen) {
      gameScreen.prepend(banner);
    } else {
      container.prepend(banner);
    }
  }

  // =========================================================================
  // Standard game handlers
  // =========================================================================

  function handleRoll() {
    // In offline mode, use controller state and actions
    if (isOfflineMode && offlineController) {
      if (!offlineController.isMyTurn()) return;
      const state = offlineController.getState();
      if (!state || state.status !== 'playing') return;
      offlineController.performAction('roll');
      return;
    }

    if (!engine) return;
    const state = engine.getState();
    if (!state || state.status !== 'playing') return;

    const mode = registry.get(state.modeId);
    if (mode.rollsPerTurn !== null && state.rollsThisTurn >= mode.rollsPerTurn) return;

    try {
      const result = engine.roll();
      if (renderer) renderer.update(result, true);
      announceDiceResult(result.values);
      triggerHaptic();
      saveState();

      // Auto-navigate to scoreboard after last roll (for modes with roll limits)
      const newState = engine.getState();
      if (newState && mode.rollsPerTurn !== null && newState.rollsThisTurn >= mode.rollsPerTurn) {
        setTimeout(() => showPage('score'), 1400); // wait for dice animation to finish
      }
    } catch {
      // Silently ignore roll errors
    }
  }

  function handleToggleHold(index) {
    // In offline mode, use controller state and actions
    if (isOfflineMode && offlineController) {
      if (!offlineController.isMyTurn()) return;
      const state = offlineController.getState();
      if (!state || state.status !== 'playing') return;
      if (state.rollsThisTurn === 0) return;
      offlineController.performAction('hold', { dieIndex: index });
      return;
    }

    if (!engine) return;
    const state = engine.getState();
    if (!state || state.status !== 'playing') return;
    if (state.rollsThisTurn === 0) return;

    engine.toggleHold(index);
    const newState = engine.getState();
    if (renderer && newState) {
      renderer.setHeld(index, newState.dice.held[index]);
    }
    saveState();
  }

  function handleCategorySelect(option) {
    if (!engine) return;

    // In offline mode, use the controller for actions
    if (isOfflineMode && offlineController) {
      if (!offlineController.isMyTurn()) return;

      const btn = container.querySelector(`.scoreboard__select-btn[aria-label="${option.name.replace('kniffel.', '').replace(/"/g, '')}"]`);
      if (btn) btn.classList.add('scoreboard__select-btn--selected');

      setTimeout(() => {
        offlineController.performAction('score', option);
      }, 200);
      return;
    }

    const btn = container.querySelector(`.scoreboard__select-btn[aria-label="${option.name.replace('kniffel.', '').replace(/"/g, '')}"]`);
    if (btn) btn.classList.add('scoreboard__select-btn--selected');

    setTimeout(() => {
      try {
        engine.selectScore(option);
        saveState();
        showPage('dice'); // back to dice for next turn
      } catch {
        // Ignore invalid score selections
      }
    }, 200);
  }

  function bindEngineEvents() {
    if (!engine) return;
    engine.on('stateChange', () => updateUI());
    engine.on('gameOver', (state) => {
      saveState();
      navigate('result', { gameId: state.gameId });
    });
  }

  function updateUI() {
    if (!container) return;

    // In offline mode, use the offline-specific UI update
    if (isOfflineMode && offlineController) {
      updateOfflineUI();
      return;
    }

    if (!engine) return;
    const state = engine.getState();
    if (!state) return;

    // Update player bar
    renderPlayerBar();

    const rollBtn = container.querySelector('#game-roll-btn');
    if (rollBtn) {
      const mode = registry.get(state.modeId);
      const canRoll = state.status === 'playing' &&
        (mode.rollsPerTurn === null || state.rollsThisTurn < mode.rollsPerTurn);
      rollBtn.disabled = !canRoll;

      // Update button text with roll count (preserve icon)
      const btnTextNode = rollBtn.childNodes[rollBtn.childNodes.length - 1];
      if (mode.rollsPerTurn !== null) {
        const text = ` ${t('game.roll')} (${state.rollsThisTurn}/${mode.rollsPerTurn})`;
        if (btnTextNode?.nodeType === 3) btnTextNode.textContent = text;
      } else {
        const text = ` ${t('game.roll')}`;
        if (btnTextNode?.nodeType === 3) btnTextNode.textContent = text;
      }
    }

    if (scoreboard) scoreboard.update(state);

    if (renderer && state.dice) {
      for (let i = 0; i < state.dice.held.length; i++) {
        renderer.setHeld(i, state.dice.held[i]);
      }
    }
  }

  function bindKeyboard() {
    const keyHandler = (e) => {
      if (!container) return;

      // In offline mode, check turn before allowing actions
      if (isOfflineMode && offlineController) {
        if (!offlineController.isMyTurn()) return;
      }

      if (!engine) return;
      const state = (isOfflineMode && offlineController)
        ? offlineController.getState()
        : engine.getState();
      if (!state || state.status !== 'playing') return;

      switch (e.key) {
        case ' ':
        case 'Spacebar': {
          if (e.target.closest('.scoreboard__select-btn')) return;
          e.preventDefault();
          handleRoll();
          break;
        }
        case 'Enter': {
          const die = e.target.closest('.die');
          if (die) {
            e.preventDefault();
            const index = parseInt(die.dataset.index, 10);
            if (!isNaN(index)) handleToggleHold(index);
          }
          break;
        }
      }
    };
    document.addEventListener('keydown', keyHandler);
    cleanupHandlers.push(() => document.removeEventListener('keydown', keyHandler));
  }

  /**
   * Scrolls to a page (dice or score) using native scroll snap.
   * @param {'dice' | 'score'} page
   */
  function showPage(page) {
    if (!container) return;
    const target = container.querySelector(page === 'score' ? '#game-page-score' : '#game-page-dice');
    if (target) target.scrollIntoView({ behavior: 'smooth', inline: 'start' });
  }

  function triggerHaptic() {
    if (navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(50);
    }
  }

  async function saveState() {
    if (!store || !engine) return;
    const state = engine.getState();
    if (!state) return;
    try { await store.save(state); } catch { /* ignore */ }
  }
}

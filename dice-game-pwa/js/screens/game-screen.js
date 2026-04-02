// Game Screen — Spielfeld mit Würfeln, Scoreboard und Spielsteuerung
// Feature: dice-game-pwa, Anforderungen: 3.3, 3.5, 4.3, 9.3, 9.4, 10.2

import { t } from '../i18n.js';
import { navigate, getParams } from '../app.js';
import { createDiceRenderer } from '../dice/dice-renderer.js';
import { announceDiceResult } from '../dice/dice-announcer.js';
import { createGameEngine } from '../game/game-engine.js';
import { createScoreboard } from '../game/scoreboard.js';
import { createGameModeRegistry } from '../game/game-mode-registry.js';
import { registerFreeRoll } from '../game/modes/free-roll.js';
import { registerKniffel } from '../game/modes/kniffel.js';
import { createGameStore } from '../store/game-store.js';

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
  let focusedDieIndex = 0;

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
      engine = createGameEngine(registry);

      if (params.gameId && store) {
        // Resume existing game
        const saved = await store.load(params.gameId);
        if (saved) {
          engine.startGame(saved.modeId, saved.players);
          // Restore state by replaying — for now start fresh with same config
          // The engine doesn't support direct state restore, so we start a new game
          // with the same mode and players. Full restore would need engine support.
        } else {
          // Game not found — start fresh with free-roll
          engine.startGame('free-roll', [{ id: 'player-1', name: t('scoreboard.player') + ' 1' }]);
        }
      } else if (params.modeId) {
        const modeId = params.modeId;
        if (params.playType === 'solo') {
          engine.startGame(modeId, [{ id: 'player-1', name: t('scoreboard.player') + ' 1' }]);
        } else {
          // Multiplayer — for now default to solo
          engine.startGame(modeId, [{ id: 'player-1', name: t('scoreboard.player') + ' 1' }]);
        }
      } else {
        // Fallback: free roll solo
        engine.startGame('free-roll', [{ id: 'player-1', name: t('scoreboard.player') + ' 1' }]);
      }

      buildUI();
      bindEngineEvents();
      bindKeyboard();
      updateUI();
    },

    unmount() {
      cleanupHandlers.forEach((fn) => fn());
      cleanupHandlers = [];
      if (renderer) renderer.destroy();
      if (scoreboard) scoreboard.destroy();
      renderer = null;
      scoreboard = null;
      engine = null;
      store = null;
      registry = null;
      if (container) {
        container.innerHTML = '';
        container = null;
      }
    },
  };

  /**
   * Builds the game screen DOM structure.
   */
  function buildUI() {
    if (!container) return;
    container.innerHTML = '';

    const state = engine.getState();
    const mode = registry.get(state.modeId);

    // Main game section
    const section = document.createElement('section');
    section.className = 'game-screen';
    section.setAttribute('aria-label', t('game.title'));

    // Header with current player info
    const header = document.createElement('header');
    header.className = 'game-screen__header';

    const playerInfo = document.createElement('p');
    playerInfo.className = 'game-screen__player-info';
    playerInfo.id = 'game-player-info';
    header.appendChild(playerInfo);

    const rollsInfo = document.createElement('p');
    rollsInfo.className = 'game-screen__rolls-info';
    rollsInfo.id = 'game-rolls-info';
    header.appendChild(rollsInfo);

    section.appendChild(header);

    // Dice area
    const diceArea = document.createElement('div');
    diceArea.className = 'game-screen__dice-area';
    diceArea.setAttribute('role', 'group');
    diceArea.setAttribute('aria-label', t('a11y.diceArea'));
    diceArea.id = 'game-dice-area';
    section.appendChild(diceArea);

    // Roll button (primary action)
    const rollBtn = document.createElement('button');
    rollBtn.type = 'button';
    rollBtn.className = 'game-screen__roll-btn';
    rollBtn.id = 'game-roll-btn';
    rollBtn.setAttribute('aria-label', t('a11y.rollButton'));
    rollBtn.textContent = t('game.roll');
    section.appendChild(rollBtn);

    // Scoreboard container
    const scoreArea = document.createElement('div');
    scoreArea.className = 'game-screen__scoreboard';
    scoreArea.id = 'game-scoreboard-area';
    section.appendChild(scoreArea);

    container.appendChild(section);

    // Initialize dice renderer
    renderer = createDiceRenderer();
    renderer.create(diceArea, mode.diceCount);

    // Initialize scoreboard
    scoreboard = createScoreboard();
    scoreboard.mount(scoreArea, state);
    scoreboard.onCategorySelect(handleCategorySelect);

    // Bind roll button
    const rollHandler = (e) => {
      e.preventDefault();
      handleRoll();
    };
    rollBtn.addEventListener('click', rollHandler);
    cleanupHandlers.push(() => rollBtn.removeEventListener('click', rollHandler));

    // Bind die click for hold/release (Three.js custom event)
    const diceClickHandler = (e) => {
      if (e.detail && e.detail.index !== undefined) {
        handleToggleHold(e.detail.index);
      }
    };
    diceArea.addEventListener('die-click', diceClickHandler);
    cleanupHandlers.push(() => diceArea.removeEventListener('die-click', diceClickHandler));
  }

  /**
   * Handles the roll action.
   */
  function handleRoll() {
    if (!engine) return;
    const state = engine.getState();
    if (!state || state.status !== 'playing') return;

    const mode = registry.get(state.modeId);
    if (mode.rollsPerTurn !== null && state.rollsThisTurn >= mode.rollsPerTurn) return;

    try {
      const result = engine.roll();

      // Update dice renderer with animation
      if (renderer) {
        renderer.update(result, true);
      }

      // Announce result for screen readers
      announceDiceResult(result.values);

      // Haptic feedback
      triggerHaptic();

      // Save state
      saveState();
    } catch {
      // Silently ignore roll errors (e.g. roll limit reached)
    }
  }

  /**
   * Handles toggling hold on a die.
   * @param {number} index
   */
  function handleToggleHold(index) {
    if (!engine) return;
    const state = engine.getState();
    if (!state || state.status !== 'playing') return;
    if (state.rollsThisTurn === 0) return; // Can't hold before first roll

    engine.toggleHold(index);

    // Update renderer visual
    const newState = engine.getState();
    if (renderer && newState) {
      renderer.setHeld(index, newState.dice.held[index]);
    }

    saveState();
  }

  /**
   * Handles category selection from scoreboard.
   * Shows a brief highlight animation on the selected cell before applying.
   * @param {{ id: string, name: string, score: number }} option
   */
  function handleCategorySelect(option) {
    if (!engine) return;

    // Flash the selected cell for visual feedback
    const btn = container.querySelector(`.scoreboard__select-btn[aria-label="${option.name.replace('kniffel.', '').replace(/"/g, '')}"]`);
    if (btn) {
      btn.classList.add('scoreboard__select-btn--selected');
    }

    // Small delay for visual feedback, then apply
    setTimeout(() => {
      try {
        engine.selectScore(option);
        saveState();
      } catch {
        // Ignore invalid score selections
      }
    }, 200);
  }

  /**
   * Binds engine events to UI updates.
   */
  function bindEngineEvents() {
    if (!engine) return;

    engine.on('stateChange', () => {
      updateUI();
    });

    engine.on('gameOver', (state) => {
      // Save final state then navigate to result
      saveState();
      navigate('result', { gameId: state.gameId });
    });
  }

  /**
   * Updates all UI elements based on current engine state.
   */
  function updateUI() {
    if (!engine || !container) return;
    const state = engine.getState();
    if (!state) return;

    // Update player info
    const playerInfo = container.querySelector('#game-player-info');
    if (playerInfo) {
      const currentPlayer = state.players[state.currentPlayerIndex];
      playerInfo.textContent = t('game.currentPlayer', { name: currentPlayer.name });
    }

    // Update rolls info
    const rollsInfo = container.querySelector('#game-rolls-info');
    if (rollsInfo) {
      const mode = registry.get(state.modeId);
      if (mode.rollsPerTurn !== null) {
        const left = mode.rollsPerTurn - state.rollsThisTurn;
        rollsInfo.textContent = t('game.rollsLeft', { count: left });
      } else {
        rollsInfo.textContent = t('game.roundUnlimited', { current: state.currentRound });
      }
    }

    // Update roll button state
    const rollBtn = container.querySelector('#game-roll-btn');
    if (rollBtn) {
      const mode = registry.get(state.modeId);
      const canRoll = state.status === 'playing' &&
        (mode.rollsPerTurn === null || state.rollsThisTurn < mode.rollsPerTurn);
      rollBtn.disabled = !canRoll;
    }

    // Update scoreboard
    if (scoreboard) {
      scoreboard.update(state);
    }

    // Sync held state on renderer
    if (renderer && state.dice) {
      for (let i = 0; i < state.dice.held.length; i++) {
        renderer.setHeld(i, state.dice.held[i]);
      }
    }
  }

  /**
   * Binds keyboard controls for accessibility.
   * Space = roll, Tab = dice navigation (handled natively), Enter = toggle hold
   */
  function bindKeyboard() {
    const keyHandler = (e) => {
      if (!engine || !container) return;
      const state = engine.getState();
      if (!state || state.status !== 'playing') return;

      switch (e.key) {
        case ' ':
        case 'Spacebar': {
          // Don't roll if focus is on a scoreboard button
          if (e.target.closest('.scoreboard__select-btn')) return;
          e.preventDefault();
          handleRoll();
          break;
        }
        case 'Enter': {
          // Toggle hold on focused die
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
   * Triggers haptic feedback via Vibration API if available.
   */
  function triggerHaptic() {
    if (navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(50);
    }
  }

  /**
   * Saves current game state to store.
   */
  async function saveState() {
    if (!store || !engine) return;
    const state = engine.getState();
    if (!state) return;
    try {
      await store.save(state);
    } catch {
      // Silently ignore save errors
    }
  }
}

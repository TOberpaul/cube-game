// Home Screen — Spielmodus-Auswahl und Spiel-Fortsetzen
// Feature: dice-game-pwa, Anforderungen: 5.3, 6.5, 9.1

import { t } from '../i18n.js';
import { navigate } from '../app.js';
import { createGameModeRegistry } from '../game/game-mode-registry.js';
import { registerFreeRoll } from '../game/modes/free-roll.js';
import { registerKniffel } from '../game/modes/kniffel.js';
import { createGameStore } from '../store/game-store.js';

/**
 * Factory for the Home Screen.
 * Shows game mode selection, play type options, and continue-game if active games exist.
 * @returns {{ mount(container: HTMLElement): void, unmount(): void }}
 */
export function createHomeScreen() {
  let container = null;
  let cleanupHandlers = [];

  return {
    async mount(el) {
      container = el;

      // Set up registry and register modes
      const registry = createGameModeRegistry();
      registerFreeRoll(registry);
      registerKniffel(registry);
      const modes = registry.getAll();

      // Check for active games
      let activeGames = [];
      try {
        const store = await createGameStore();
        activeGames = await store.listActive();
      } catch {
        // Silently ignore — no continue option shown
      }

      render(modes, activeGames);
    },

    unmount() {
      cleanupHandlers.forEach((fn) => fn());
      cleanupHandlers = [];
      if (container) {
        container.innerHTML = '';
        container = null;
      }
    },
  };

  /**
   * Renders the home screen UI.
   */
  function render(modes, activeGames) {
    if (!container) return;

    const hasContinue = activeGames.length > 0;

    // Build the screen
    const section = document.createElement('section');
    section.className = 'home-screen';
    section.setAttribute('aria-label', t('home.title'));

    // Title
    const heading = document.createElement('h1');
    heading.className = 'home-screen__title';
    heading.textContent = t('home.title');
    section.appendChild(heading);

    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.className = 'home-screen__subtitle';
    subtitle.textContent = t('home.subtitle');
    section.appendChild(subtitle);

    // Continue game button (primary action if active games exist)
    if (hasContinue) {
      const continueBtn = createButton(
        t('home.continueGame'),
        true, // primary
        () => {
          const game = activeGames[0];
          navigate('game', { gameId: game.gameId });
        }
      );
      continueBtn.setAttribute('aria-label', t('home.continueGame'));
      section.appendChild(continueBtn);
    }

    // Game mode selection
    const modeNav = document.createElement('nav');
    modeNav.className = 'home-screen__modes';
    modeNav.setAttribute('aria-label', t('home.selectMode'));

    const modeHeading = document.createElement('h2');
    modeHeading.className = 'home-screen__section-title';
    modeHeading.textContent = t('home.selectMode');
    modeNav.appendChild(modeHeading);

    const modeList = document.createElement('ul');
    modeList.className = 'home-screen__mode-list';
    modeList.setAttribute('role', 'list');

    modes.forEach((mode, index) => {
      const li = document.createElement('li');
      li.className = 'home-screen__mode-item';

      // Mode button — primary only if first mode AND no continue game
      const isPrimary = !hasContinue && index === 0;
      const modeBtn = createButton(
        t(mode.name),
        isPrimary,
        () => showPlayTypeOptions(mode.id)
      );
      modeBtn.setAttribute('data-mode-id', mode.id);

      // Add description if available
      const descKey = `${mode.name}.description`;
      const desc = t(descKey);
      if (desc !== descKey) {
        const descEl = document.createElement('span');
        descEl.className = 'home-screen__mode-desc';
        descEl.textContent = desc;
        modeBtn.appendChild(descEl);
      }

      li.appendChild(modeBtn);
      modeList.appendChild(li);
    });

    modeNav.appendChild(modeList);
    section.appendChild(modeNav);

    // Play type options container (hidden initially)
    const playTypeSection = document.createElement('div');
    playTypeSection.className = 'home-screen__play-types';
    playTypeSection.setAttribute('role', 'group');
    playTypeSection.setAttribute('aria-label', t('home.subtitle'));
    playTypeSection.hidden = true;
    playTypeSection.id = 'play-type-options';
    section.appendChild(playTypeSection);

    container.innerHTML = '';
    container.appendChild(section);
  }

  /**
   * Shows play type options (Solo, Online, Offline) for a selected mode.
   */
  function showPlayTypeOptions(modeId) {
    const playTypeSection = container.querySelector('#play-type-options');
    if (!playTypeSection) return;

    playTypeSection.hidden = false;
    playTypeSection.innerHTML = '';

    const playTypes = [
      {
        key: 'home.solo',
        action: () => navigate('game', { modeId, playType: 'solo' }),
      },
      {
        key: 'home.onlineMultiplayer',
        action: () => navigate('lobby', { modeId, playType: 'online' }),
      },
      {
        key: 'home.offlineMultiplayer',
        action: () => navigate('lobby', { modeId, playType: 'offline' }),
      },
    ];

    const list = document.createElement('ul');
    list.className = 'home-screen__play-type-list';
    list.setAttribute('role', 'list');

    playTypes.forEach((pt) => {
      const li = document.createElement('li');
      li.className = 'home-screen__play-type-item';

      const btn = createButton(t(pt.key), false, pt.action);
      li.appendChild(btn);
      list.appendChild(li);
    });

    playTypeSection.appendChild(list);
    // Focus the first play type button for accessibility
    const firstBtn = list.querySelector('button');
    if (firstBtn) firstBtn.focus();
  }

  /**
   * Creates a styled button element.
   */
  function createButton(text, isPrimary, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = isPrimary
      ? 'home-screen__btn home-screen__btn--primary'
      : 'home-screen__btn';
    btn.textContent = text;

    const handler = (e) => {
      e.preventDefault();
      onClick();
    };
    btn.addEventListener('click', handler);
    cleanupHandlers.push(() => btn.removeEventListener('click', handler));

    return btn;
  }
}

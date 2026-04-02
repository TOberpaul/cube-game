// Home Screen — Game mode selection with play-type dialog
// Feature: dice-game-pwa, Requirements: 5.3, 6.5, 9.1

import { t } from '../i18n.js';
import { navigate } from '../app.js';
import { loadTemplate } from '../template-loader.js';
import { createGameModeRegistry } from '../game/game-mode-registry.js';
import { registerFreeRoll } from '../game/modes/free-roll.js';
import { registerKniffel } from '../game/modes/kniffel.js';
import { createGameStore } from '../store/game-store.js';
import { getAvatar } from '../avatars.js';

export function createHomeScreen() {
  let container = null;
  let cleanupHandlers = [];
  let dialogEl = null;

  return {
    async mount(el) {
      container = el;

      const registry = createGameModeRegistry();
      registerFreeRoll(registry);
      registerKniffel(registry);
      const modes = registry.getAll();

      let activeGames = [];
      try {
        const store = await createGameStore();
        activeGames = await store.listActive();
      } catch { /* ignore */ }

      await render(modes, activeGames);
    },

    unmount() {
      closeDialog();
      cleanupHandlers.forEach((fn) => fn());
      cleanupHandlers = [];
      if (container) {
        container.innerHTML = '';
        container = null;
      }
    },
  };

  async function render(modes, activeGames) {
    if (!container) return;
    const hasContinue = activeGames.length > 0;

    const fragment = await loadTemplate('templates/home.html', t);
    const section = fragment.querySelector('.home-screen');

    // Active game section — show continue + end buttons if game exists
    if (hasContinue) {
      const activeSlot = fragment.querySelector('[data-slot="active-game"]');
      activeSlot.removeAttribute('hidden');

      const continueBtn = fragment.querySelector('#home-continue-btn');
      const continueHandler = (e) => { e.preventDefault(); navigate('game', { gameId: activeGames[0].gameId }); };
      continueBtn.addEventListener('click', continueHandler);
      cleanupHandlers.push(() => continueBtn.removeEventListener('click', continueHandler));
    }

    // Populate mode list from card template
    const modeList = fragment.querySelector('[data-slot="mode-list"]');
    const cardTemplate = await loadTemplate('templates/mode-card.html', t);

    modes.forEach((mode) => {
      const card = cardTemplate.querySelector('article').cloneNode(true);

      card.querySelector('[data-bind="title"]').textContent = t(mode.name);

      const descKey = `${mode.name}.description`;
      const desc = t(descKey);
      const descEl = card.querySelector('[data-bind="description"]');
      if (desc !== descKey) {
        descEl.textContent = desc;
      } else {
        descEl.remove();
      }

      const handler = (e) => { e.preventDefault(); openPlayTypeDialog(mode); };
      card.addEventListener('click', handler);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlayTypeDialog(mode); } });
      cleanupHandlers.push(() => card.removeEventListener('click', handler));

      modeList.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(fragment);

    // Carousel fade edges based on scroll position
    const carouselList = container.querySelector('.home-screen__mode-list');
    const modesNav = container.querySelector('.home-screen__modes');
    if (carouselList && modesNav) {
      const updateFades = () => {
        const { scrollLeft, scrollWidth, clientWidth } = carouselList;
        modesNav.classList.toggle('home-screen__modes--fade-left', scrollLeft > 4);
        modesNav.classList.toggle('home-screen__modes--fade-right', scrollLeft < scrollWidth - clientWidth - 4);
      };
      carouselList.addEventListener('scroll', updateFades, { passive: true });
      cleanupHandlers.push(() => carouselList.removeEventListener('scroll', updateFades));
      requestAnimationFrame(updateFades);
    }
  }

  async function openPlayTypeDialog(mode) {
    closeDialog();

    const fragment = await loadTemplate('templates/home-dialog.html', t);

    // Set dynamic content
    const title = fragment.querySelector('#dialog-title');
    title.textContent = t(mode.name);

    const desc = fragment.querySelector('#dialog-description');
    const descKey = `${mode.name}.description`;
    const descText = t(descKey);
    if (descText !== descKey) {
      desc.textContent = descText;
    } else {
      desc.remove();
    }

    // Get the backdrop (root element)
    const backdrop = fragment.querySelector('.dialog-backdrop');

    // Bind close button
    const closeBtn = fragment.querySelector('#dialog-close-btn');
    const closeHandler = (e) => { e.preventDefault(); closeDialog(); };
    closeBtn.addEventListener('click', closeHandler);
    cleanupHandlers.push(() => closeBtn.removeEventListener('click', closeHandler));

    // Bind backdrop click
    const backdropClick = (e) => { if (e.target === dialogEl) closeDialog(); };

    // Bind play type buttons
    const soloBtn = fragment.querySelector('#dialog-solo-btn');
    const onlineBtn = fragment.querySelector('#dialog-online-btn');
    const offlineBtn = fragment.querySelector('#dialog-offline-btn');

    const bindOption = (btn, action) => {
      const handler = (e) => { e.preventDefault(); e.stopPropagation(); closeDialog(); action(); };
      btn.addEventListener('click', handler);
      cleanupHandlers.push(() => btn.removeEventListener('click', handler));
    };

    bindOption(soloBtn, () => navigate('game', { modeId: mode.id, playType: 'solo' }));
    bindOption(onlineBtn, () => navigate('lobby', { modeId: mode.id, playType: 'online' }));
    bindOption(offlineBtn, () => navigate('lobby', { modeId: mode.id, playType: 'offline' }));

    // Local multiplayer — open player setup dialog
    const localBtn = fragment.querySelector('#dialog-local-btn');
    localBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeDialog();
      openPlayerSetupDialog(mode);
    });

    // Escape key
    const escHandler = (e) => { if (e.key === 'Escape') closeDialog(); };
    document.addEventListener('keydown', escHandler);
    cleanupHandlers.push(() => document.removeEventListener('keydown', escHandler));

    document.body.appendChild(fragment);
    dialogEl = document.body.querySelector('.dialog-backdrop:last-child');
    dialogEl.addEventListener('click', backdropClick);
    cleanupHandlers.push(() => { if (dialogEl) dialogEl.removeEventListener('click', backdropClick); });

    // Focus first option
    soloBtn.focus();
  }

  async function openPlayerSetupDialog(mode) {
    closeDialog();

    const fragment = await loadTemplate('templates/player-setup.html', t);
    let playerCount = 2;

    // Close & back buttons
    const closeBtn = fragment.querySelector('#setup-close-btn');
    closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeDialog(); });

    const backBtn = fragment.querySelector('#setup-back-btn');
    backBtn.addEventListener('click', (e) => { e.preventDefault(); closeDialog(); openPlayTypeDialog(mode); });

    // Player count picker
    const picker = fragment.querySelector('#setup-player-count');
    const namesContainer = fragment.querySelector('#setup-player-names');

    function renderNameInputs(count) {
      namesContainer.innerHTML = '';
      for (let i = 0; i < count; i++) {
        const label = document.createElement('label');
        label.className = 'adaptive input';

        const labelText = document.createElement('span');
        labelText.className = 'input__label';
        labelText.textContent = `${getAvatar(i)} ${t('scoreboard.player')} ${i + 1}`;
        label.appendChild(labelText);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'adaptive input__field';
        input.setAttribute('data-material', 'filled-2');
        input.setAttribute('data-interactive', '');
        input.placeholder = `${t('scoreboard.player')} ${i + 1}`;
        input.dataset.playerIndex = String(i);
        label.appendChild(input);

        namesContainer.appendChild(label);
      }
    }

    renderNameInputs(playerCount);

    picker.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-value]');
      if (!btn) return;
      playerCount = parseInt(btn.dataset.value, 10);
      picker.querySelectorAll('.dice-count-picker__btn').forEach((b) => {
        b.classList.remove('dice-count-picker__btn--active');
        b.setAttribute('data-material', 'filled-2');
        b.removeAttribute('aria-pressed');
      });
      btn.classList.add('dice-count-picker__btn--active');
      btn.setAttribute('data-material', 'inverted');
      btn.setAttribute('aria-pressed', 'true');
      renderNameInputs(playerCount);
    });

    // Start button
    const startBtn = fragment.querySelector('#setup-start-btn');
    startBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Collect names from inputs
      const names = [];
      namesContainer.querySelectorAll('input').forEach((input, i) => {
        names.push(input.value.trim() || `${t('scoreboard.player')} ${i + 1}`);
      });
      closeDialog();
      navigate('game', { modeId: mode.id, playType: 'local', playerCount, playerNames: names.join(',') });
    });

    // Escape key
    const escHandler = (e) => { if (e.key === 'Escape') closeDialog(); };
    document.addEventListener('keydown', escHandler);
    cleanupHandlers.push(() => document.removeEventListener('keydown', escHandler));

    // Backdrop click
    document.body.appendChild(fragment);
    dialogEl = document.body.querySelector('.dialog-backdrop:last-child');
    dialogEl.addEventListener('click', (e) => { if (e.target === dialogEl) closeDialog(); });
  }

  function closeDialog() {
    if (dialogEl) {
      dialogEl.remove();
      dialogEl = null;
    }
  }
}

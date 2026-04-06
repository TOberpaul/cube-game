// Home Screen — Game mode selection with play-type dialog
// Feature: dice-game-pwa, Requirements: 5.3, 6.5, 9.1

import { t } from '../i18n.js';
import { navigate } from '../app.js';
import { loadTemplate } from '../template-loader.js';
import { createGameModeRegistry } from '../game/game-mode-registry.js';
import { registerFreeRoll } from '../game/modes/free-roll.js';
import { registerKniffel } from '../game/modes/kniffel.js';
import { getAvatar } from '../avatars.js';
import { createGameStore } from '../store/game-store.js';

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

      await render(modes);
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

  async function render(modes) {
    if (!container) return;

    const fragment = await loadTemplate('templates/home.html', t);

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

      const handler = (e) => {
        e.preventDefault();
        if (mode.id === 'free-roll') {
          const savedName = localStorage.getItem('dice-player-name') || '';
          const name = savedName || t('scoreboard.player');
          navigate('game', { modeId: mode.id, playType: 'solo', playerNames: name });
        } else {
          openPlayTypeDialog(mode);
        }
      };
      card.addEventListener('click', handler);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); } });
      cleanupHandlers.push(() => card.removeEventListener('click', handler));

      modeList.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(fragment);

    // Load and display highscores
    loadHighscores();

    // Show app version from SW cache name — tap to clear cache and reload
    const versionEl = container.querySelector('#app-version');
    if (versionEl) {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => {
          if (e.data && e.data.version) versionEl.textContent = e.data.version;
        };
        navigator.serviceWorker.controller.postMessage({ type: 'getVersion' }, [channel.port2]);
      } else {
        versionEl.textContent = 'no SW';
      }

      const versionHandler = async () => {
        versionEl.textContent = 'Cache wird gelöscht…';
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
          if (navigator.serviceWorker) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
          }
        } catch { /* ignore */ }
        window.location.reload();
      };
      versionEl.addEventListener('click', versionHandler);
      cleanupHandlers.push(() => versionEl.removeEventListener('click', versionHandler));
    }

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
    const backdrop = fragment.querySelector('.modal-backdrop');

    // Bind close button
    const closeBtn = fragment.querySelector('#dialog-close-btn');
    const closeHandler = (e) => { e.preventDefault(); closeDialog(); };
    closeBtn.addEventListener('click', closeHandler);
    cleanupHandlers.push(() => closeBtn.removeEventListener('click', closeHandler));

    // Bind backdrop click
    const backdropClick = (e) => { if (e.target === dialogEl) closeDialog(); };

    // Bind play type buttons
    const soloBtn = fragment.querySelector('#dialog-solo-btn');
    const offlineBtn = fragment.querySelector('#dialog-offline-btn');

    const bindOption = (btn, action) => {
      const handler = (e) => { e.preventDefault(); e.stopPropagation(); closeDialog(); action(); };
      btn.addEventListener('click', handler);
      cleanupHandlers.push(() => btn.removeEventListener('click', handler));
    };

    bindOption(soloBtn, () => openPlayerSetupDialog(mode, true));
    bindOption(offlineBtn, () => navigate('lobby', { modeId: mode.id, playType: 'offline', role: 'host' }));

    // Join game — client flow for offline multiplayer
    const joinBtn = fragment.querySelector('#dialog-join-btn');
    bindOption(joinBtn, () => navigate('lobby', { playType: 'offline', role: 'client' }));

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
    dialogEl = document.body.querySelector('.modal-backdrop:last-child');
    dialogEl.addEventListener('click', backdropClick);
    cleanupHandlers.push(() => { if (dialogEl) dialogEl.removeEventListener('click', backdropClick); });

    // Focus first option
    soloBtn.focus();
  }

  async function openPlayerSetupDialog(mode, isSolo = false) {
    closeDialog();

    const fragment = await loadTemplate('templates/player-setup.html', t);
    let playerCount = isSolo ? 1 : 2;

    // Close & back buttons
    const closeBtn = fragment.querySelector('#setup-close-btn');
    closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeDialog(); });

    const backBtn = fragment.querySelector('#setup-back-btn');
    backBtn.addEventListener('click', (e) => { e.preventDefault(); closeDialog(); if (!isSolo) openPlayTypeDialog(mode); });

    // Player count picker — hide for solo
    const picker = fragment.querySelector('#setup-player-count');
    const countLabel = fragment.querySelector('.dialog__local-label');
    if (isSolo) {
      if (picker) picker.hidden = true;
      if (countLabel) countLabel.hidden = true;
    }
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
        // Pre-fill with saved name for solo
        if (isSolo) {
          input.value = localStorage.getItem('dice-player-name') || '';
        }
        label.appendChild(input);

        namesContainer.appendChild(label);
      }
    }

    renderNameInputs(playerCount);

    if (!isSolo) {
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
    }

    // Start button
    const startBtn = fragment.querySelector('#setup-start-btn');
    startBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const names = [];
      namesContainer.querySelectorAll('input').forEach((input, i) => {
        names.push(input.value.trim() || `${t('scoreboard.player')} ${i + 1}`);
      });
      // Save solo name for next time
      if (isSolo && names[0]) {
        localStorage.setItem('dice-player-name', names[0]);
      }
      closeDialog();
      const playType = isSolo ? 'solo' : 'local';
      navigate('game', { modeId: mode.id, playType, playerCount, playerNames: names.join(',') });
    });

    // Escape key
    const escHandler = (e) => { if (e.key === 'Escape') closeDialog(); };
    document.addEventListener('keydown', escHandler);
    cleanupHandlers.push(() => document.removeEventListener('keydown', escHandler));

    // Backdrop click
    document.body.appendChild(fragment);
    dialogEl = document.body.querySelector('.modal-backdrop:last-child');
    dialogEl.addEventListener('click', (e) => { if (e.target === dialogEl) closeDialog(); });
  }

  function closeDialog() {
    if (dialogEl) {
      dialogEl.remove();
      dialogEl = null;
    }
  }

  async function loadHighscores() {
    if (!container) return;
    const listEl = container.querySelector('[data-slot="highscores"]');
    const wrapperEl = container.querySelector('#highscore-list');
    if (!listEl || !wrapperEl) return;

    try {
      const store = await createGameStore();
      const finished = await store.listFinished();
      if (!finished.length) return;

      // Extract best scores per player across all finished Kniffel games
      const scores = [];
      for (const game of finished) {
        if (!game.scores || !game.players) continue;
        for (const player of game.players) {
          const sheet = game.scores[player.id];
          if (sheet && typeof sheet.totalScore === 'number') {
            scores.push({
              name: player.name,
              avatar: player.avatar || '',
              score: sheet.totalScore,
              mode: game.modeId,
              date: game.updatedAt,
            });
          }
        }
      }

      if (!scores.length) return;

      // Sort by score descending, take top 5
      scores.sort((a, b) => b.score - a.score);
      const top = scores.slice(0, 5);

      listEl.innerHTML = '';
      for (const entry of top) {
        const li = document.createElement('li');
        li.className = 'adaptive home-screen__highscore-item';
        li.setAttribute('data-material', 'semi-transparent');
        const avatarHtml = entry.avatar ? `<span class="home-screen__highscore-avatar">${entry.avatar}</span>` : '';
        li.innerHTML = avatarHtml
          + `<span class="home-screen__highscore-name">${entry.name}</span>`
          + `<span class="home-screen__highscore-score">${entry.score}</span>`;
        listEl.appendChild(li);
      }

      wrapperEl.hidden = false;
    } catch {
      // Silently fail — highscores are optional
    }
  }
}

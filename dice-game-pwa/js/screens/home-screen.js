// Home Screen — Spielmodus-Auswahl mit Dialog für Spieltyp
// Feature: dice-game-pwa, Anforderungen: 5.3, 6.5, 9.1

import { t } from '../i18n.js';
import { navigate } from '../app.js';
import { createGameModeRegistry } from '../game/game-mode-registry.js';
import { registerFreeRoll } from '../game/modes/free-roll.js';
import { registerKniffel } from '../game/modes/kniffel.js';
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

      let activeGames = [];
      try {
        const store = await createGameStore();
        activeGames = await store.listActive();
      } catch { /* ignore */ }

      render(modes, activeGames);
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

  function render(modes, activeGames) {
    if (!container) return;
    const hasContinue = activeGames.length > 0;

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

    // Continue game button (only if active games exist)
    if (hasContinue) {
      const continueBtn = createButton(t('home.continueGame'), false, () => {
        navigate('game', { gameId: activeGames[0].gameId });
      });
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

    modes.forEach((mode) => {
      const li = document.createElement('li');
      li.className = 'home-screen__mode-item';

      const modeBtn = createButton(t(mode.name), false, () => {
        openPlayTypeDialog(mode);
      });

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

    container.innerHTML = '';
    container.appendChild(section);
  }

  function openPlayTypeDialog(mode) {
    closeDialog();

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    const backdropClick = () => closeDialog();
    backdrop.addEventListener('click', backdropClick);
    cleanupHandlers.push(() => backdrop.removeEventListener('click', backdropClick));

    // Dialog
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', t('home.play'));

    // Header
    const title = document.createElement('h2');
    title.className = 'dialog__title';
    title.textContent = t(mode.name);
    dialog.appendChild(title);

    const desc = t(`${mode.name}.description`);
    if (desc !== `${mode.name}.description`) {
      const descEl = document.createElement('p');
      descEl.className = 'dialog__desc';
      descEl.textContent = desc;
      dialog.appendChild(descEl);
    }

    // Play type options
    const options = document.createElement('div');
    options.className = 'dialog__options';

    const playTypes = [
      { key: 'home.solo', icon: '👤', action: () => { closeDialog(); navigate('game', { modeId: mode.id, playType: 'solo' }); } },
      { key: 'home.onlineMultiplayer', icon: '🌐', action: () => { closeDialog(); navigate('lobby', { modeId: mode.id, playType: 'online' }); } },
      { key: 'home.offlineMultiplayer', icon: '📡', action: () => { closeDialog(); navigate('lobby', { modeId: mode.id, playType: 'offline' }); } },
    ];

    for (const pt of playTypes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dialog__option';
      btn.innerHTML = `<span class="dialog__option-icon">${pt.icon}</span><span class="dialog__option-label">${t(pt.key)}</span>`;
      const handler = (e) => { e.preventDefault(); e.stopPropagation(); pt.action(); };
      btn.addEventListener('click', handler);
      cleanupHandlers.push(() => btn.removeEventListener('click', handler));
      options.appendChild(btn);
    }

    dialog.appendChild(options);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'dialog__close';
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.textContent = '✕';
    const closeHandler = (e) => { e.preventDefault(); closeDialog(); };
    closeBtn.addEventListener('click', closeHandler);
    cleanupHandlers.push(() => closeBtn.removeEventListener('click', closeHandler));
    dialog.appendChild(closeBtn);

    // Escape key
    const escHandler = (e) => { if (e.key === 'Escape') closeDialog(); };
    document.addEventListener('keydown', escHandler);
    cleanupHandlers.push(() => document.removeEventListener('keydown', escHandler));

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    dialogEl = backdrop;

    // Focus first option
    const firstBtn = options.querySelector('button');
    if (firstBtn) firstBtn.focus();
  }

  function closeDialog() {
    if (dialogEl) {
      dialogEl.remove();
      dialogEl = null;
    }
  }

  function createButton(text, isPrimary, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = isPrimary ? 'home-screen__btn home-screen__btn--primary' : 'home-screen__btn';
    btn.textContent = text;
    const handler = (e) => { e.preventDefault(); onClick(); };
    btn.addEventListener('click', handler);
    cleanupHandlers.push(() => btn.removeEventListener('click', handler));
    return btn;
  }
}

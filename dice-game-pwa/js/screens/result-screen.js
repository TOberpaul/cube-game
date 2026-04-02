// Result Screen — Ergebnisübersicht mit Endpunktzahlen und Platzierungen
// Feature: dice-game-pwa, Anforderung: 6.3

import { t } from '../i18n.js';
import { navigate, getParams } from '../app.js';
import { createGameStore } from '../store/game-store.js';
import { createGameModeRegistry } from '../game/game-mode-registry.js';
import { registerFreeRoll } from '../game/modes/free-roll.js';
import { registerKniffel } from '../game/modes/kniffel.js';

/**
 * Factory for the Result Screen.
 * Shows final scores, placements, winner announcement, and options for new game / rematch.
 * @returns {{ mount(container: HTMLElement): void, unmount(): void }}
 */
export function createResultScreen() {
  let container = null;
  let cleanupHandlers = [];

  return {
    async mount(el) {
      container = el;

      const params = getParams();
      const gameId = params.gameId;

      if (!gameId) {
        renderError();
        return;
      }

      try {
        const store = await createGameStore();
        const state = await store.load(gameId);

        if (!state) {
          renderError();
          return;
        }

        const registry = createGameModeRegistry();
        registerFreeRoll(registry);
        registerKniffel(registry);

        const mode = registry.get(state.modeId);
        const scores = mode
          ? mode.scoring.getFinalScores(state)
          : buildFallbackScores(state);

        render(scores, state.modeId);
      } catch {
        renderError();
      }
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
   * Builds fallback scores when mode is not found in registry.
   */
  function buildFallbackScores(state) {
    return state.players.map((p, i) => ({
      playerId: p.id,
      name: p.name,
      totalScore: (state.scores[p.id] && state.scores[p.id].totalScore) || 0,
      rank: i + 1,
    }));
  }

  /**
   * Renders the result screen UI.
   */
  function render(scores, modeId) {
    if (!container) return;

    const section = document.createElement('section');
    section.className = 'result-screen';
    section.setAttribute('aria-label', t('result.title'));

    // Title
    const heading = document.createElement('h1');
    heading.className = 'result-screen__title';
    heading.textContent = t('result.title');
    section.appendChild(heading);

    // Winner announcement
    const announcement = document.createElement('p');
    announcement.className = 'result-screen__announcement';
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');

    const isDraw = scores.length > 1 && scores[0].rank === scores[1].rank;
    announcement.textContent = isDraw
      ? t('result.draw')
      : t('result.winner', { name: scores[0].name });
    section.appendChild(announcement);

    // Rankings list
    const list = document.createElement('ol');
    list.className = 'result-screen__rankings';
    list.setAttribute('aria-label', t('result.title'));

    for (const entry of scores) {
      const li = document.createElement('li');
      li.className = 'result-screen__player';
      li.setAttribute('aria-label',
        `${t('result.placement', { rank: entry.rank })} — ${entry.name}: ${t('result.finalScore', { points: entry.totalScore })}`
      );

      const rankSpan = document.createElement('span');
      rankSpan.className = 'result-screen__rank';
      rankSpan.textContent = t('result.placement', { rank: entry.rank });

      const nameSpan = document.createElement('span');
      nameSpan.className = 'result-screen__name';
      nameSpan.textContent = entry.name;

      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'result-screen__score';
      scoreSpan.textContent = t('result.finalScore', { points: entry.totalScore });

      li.appendChild(rankSpan);
      li.appendChild(nameSpan);
      li.appendChild(scoreSpan);
      list.appendChild(li);
    }

    section.appendChild(list);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'result-screen__actions';
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', t('result.backToHome'));

    // Rematch button
    const rematchBtn = createButton(t('result.rematch'), false, () => {
      navigate('game', { modeId });
    });
    actions.appendChild(rematchBtn);

    // New Game button (primary)
    const newGameBtn = createButton(t('result.newGame'), true, () => {
      navigate('home');
    });
    actions.appendChild(newGameBtn);

    section.appendChild(actions);

    container.innerHTML = '';
    container.appendChild(section);
  }

  /**
   * Renders an error state when game cannot be loaded.
   */
  function renderError() {
    if (!container) return;

    const section = document.createElement('section');
    section.className = 'result-screen';
    section.setAttribute('aria-label', t('result.title'));

    const msg = document.createElement('p');
    msg.className = 'result-screen__error';
    msg.textContent = t('error.gameNotFound');
    section.appendChild(msg);

    const homeBtn = createButton(t('result.backToHome'), true, () => {
      navigate('home');
    });
    section.appendChild(homeBtn);

    container.innerHTML = '';
    container.appendChild(section);
  }

  /**
   * Creates a styled button element.
   */
  function createButton(text, isPrimary, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = isPrimary
      ? 'result-screen__btn result-screen__btn--primary'
      : 'result-screen__btn';
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

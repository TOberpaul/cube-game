// Result Screen — Final scores, rankings, and replay options
// Feature: dice-game-pwa, Requirement: 6.3

import { t } from '../i18n.js';
import { navigate, getParams } from '../app.js';
import { loadTemplate } from '../template-loader.js';
import { createGameStore } from '../store/game-store.js';
import { createGameModeRegistry } from '../game/game-mode-registry.js';
import { registerFreeRoll } from '../game/modes/free-roll.js';
import { registerKniffel } from '../game/modes/kniffel.js';

/**
 * Factory for the Result Screen.
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
        await renderError();
        return;
      }

      try {
        const store = await createGameStore();
        const state = await store.load(gameId);

        if (!state) {
          await renderError();
          return;
        }

        const registry = createGameModeRegistry();
        registerFreeRoll(registry);
        registerKniffel(registry);

        const mode = registry.get(state.modeId);
        const scores = mode
          ? mode.scoring.getFinalScores(state)
          : buildFallbackScores(state);

        await render(scores, state.modeId);
      } catch {
        await renderError();
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

  function buildFallbackScores(state) {
    return state.players.map((p, i) => ({
      playerId: p.id,
      name: p.name,
      totalScore: (state.scores[p.id] && state.scores[p.id].totalScore) || 0,
      rank: i + 1,
    }));
  }

  async function render(scores, modeId) {
    if (!container) return;

    const fragment = await loadTemplate('templates/result.html', t);

    // Winner announcement
    const announcement = fragment.querySelector('#result-announcement');
    const isDraw = scores.length > 1 && scores[0].rank === scores[1].rank;
    announcement.textContent = isDraw
      ? t('result.draw')
      : t('result.winner', { name: scores[0].name });

    // Rankings
    const rankingsList = fragment.querySelector('[data-slot="rankings"]');
    for (const entry of scores) {
      const li = document.createElement('li');
      li.className = 'adaptive result-screen__player';
      li.setAttribute('data-material', 'filled');
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
      rankingsList.appendChild(li);
    }

    // Bind action buttons
    const rematchBtn = fragment.querySelector('#result-rematch-btn');
    const rematchHandler = (e) => { e.preventDefault(); navigate('game', { modeId }); };
    rematchBtn.addEventListener('click', rematchHandler);
    cleanupHandlers.push(() => rematchBtn.removeEventListener('click', rematchHandler));

    const newGameBtn = fragment.querySelector('#result-new-game-btn');
    const newGameHandler = (e) => { e.preventDefault(); navigate('home'); };
    newGameBtn.addEventListener('click', newGameHandler);
    cleanupHandlers.push(() => newGameBtn.removeEventListener('click', newGameHandler));

    container.innerHTML = '';
    container.appendChild(fragment);
  }

  async function renderError() {
    if (!container) return;

    const fragment = await loadTemplate('templates/result-error.html', t);

    const homeBtn = fragment.querySelector('#result-home-btn');
    const homeHandler = (e) => { e.preventDefault(); navigate('home'); };
    homeBtn.addEventListener('click', homeHandler);
    cleanupHandlers.push(() => homeBtn.removeEventListener('click', homeHandler));

    container.innerHTML = '';
    container.appendChild(fragment);
  }
}

// Scoreboard — DOM rendering based on GameState
// Feature: dice-game-pwa, Anforderungen: 6.1, 6.2, 6.3

import { t } from '../i18n.js';

/**
 * Upper block categories for Kniffel.
 */
const UPPER_CATEGORIES = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];

/**
 * Lower block categories for Kniffel.
 */
const LOWER_CATEGORIES = [
  'threeOfAKind',
  'fourOfAKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'kniffel',
  'chance',
];

/**
 * Creates a Scoreboard component.
 * @returns {{ mount, update, destroy, onCategorySelect }}
 */
export function createScoreboard() {
  let containerEl = null;
  let rootEl = null;
  let categoryHandler = null;
  let currentState = null;

  /**
   * Registers a handler called when a player clicks a scoreable category.
   * @param {(option: { id: string, name: string, score: number }) => void} handler
   */
  function onCategorySelect(handler) {
    categoryHandler = handler;
  }

  /**
   * Mounts the scoreboard into a container element.
   * @param {HTMLElement} container
   * @param {object} gameState
   */
  function mount(container, gameState) {
    containerEl = container;
    currentState = gameState;
    rootEl = document.createElement('div');
    rootEl.className = 'scoreboard';
    rootEl.setAttribute('role', 'region');
    rootEl.setAttribute('aria-label', t('a11y.scoreboardArea'));
    containerEl.appendChild(rootEl);
    render(gameState);
  }

  /**
   * Updates the scoreboard with new state.
   * @param {object} gameState
   */
  function update(gameState) {
    currentState = gameState;
    if (!rootEl) return;
    render(gameState);
  }

  /**
   * Removes the scoreboard from the DOM.
   */
  function destroy() {
    if (rootEl && containerEl) {
      containerEl.removeChild(rootEl);
    }
    rootEl = null;
    containerEl = null;
    currentState = null;
    categoryHandler = null;
  }

  /**
   * Renders the scoreboard content based on game mode.
   * @param {object} state
   */
  function render(state) {
    if (!rootEl || !state) return;
    rootEl.innerHTML = '';

    if (state.modeId === 'kniffel') {
      renderKniffel(state);
    } else {
      renderSimple(state);
    }
  }

  /**
   * Renders a simple total-score display for free-roll and similar modes.
   * Free roll has no meaningful score — hide the scoreboard entirely.
   * @param {object} state
   */
  function renderSimple(state) {
    // No scoreboard for free roll — just show the dice sum after rolling
    if (state.rollsThisTurn > 0 && state.dice?.values) {
      const sum = state.dice.values.reduce((a, b) => a + b, 0);
      const sumEl = document.createElement('p');
      sumEl.className = 'adaptive text scoreboard__round';
      sumEl.textContent = t('game.diceSum', { sum });
      rootEl.appendChild(sumEl);
    }
  }

  /**
   * Renders the full Kniffel scoreboard table with 13 categories + bonus.
   * @param {object} state
   */
  function renderKniffel(state) {
    const heading = document.createElement('h2');
    heading.className = 'adaptive headline scoreboard__title';
    heading.setAttribute('data-level', '4');
    heading.textContent = t('scoreboard.title');
    rootEl.appendChild(heading);

    // Round info
    const roundEl = document.createElement('p');
    roundEl.className = 'adaptive text text--small scoreboard__round';
    if (state.maxRounds != null) {
      roundEl.textContent = t('game.round', { current: state.currentRound, max: state.maxRounds });
    } else {
      roundEl.textContent = t('game.roundUnlimited', { current: state.currentRound });
    }
    rootEl.appendChild(roundEl);

    const table = document.createElement('table');
    table.className = 'scoreboard__table';
    table.setAttribute('role', 'table');
    table.setAttribute('aria-label', t('scoreboard.title'));

    // Header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const categoryTh = document.createElement('th');
    categoryTh.className = 'scoreboard__category-header';
    categoryTh.setAttribute('scope', 'col');
    categoryTh.textContent = '';
    headerRow.appendChild(categoryTh);

    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      const isActive = i === state.currentPlayerIndex;
      const th = document.createElement('th');
      th.className = 'scoreboard__player-header' + (isActive ? ' scoreboard__player--active' : '');
      th.setAttribute('scope', 'col');
      th.setAttribute('aria-current', isActive ? 'true' : 'false');
      th.textContent = player.name;
      headerRow.appendChild(th);
    }

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    // Upper block
    for (const cat of UPPER_CATEGORIES) {
      tbody.appendChild(createCategoryRow(cat, state));
    }

    // Upper bonus row
    tbody.appendChild(createBonusRow(state));

    // Separator / upper total
    tbody.appendChild(createSectionRow('scoreboard.upperTotal', state, UPPER_CATEGORIES));

    // Lower block
    for (const cat of LOWER_CATEGORIES) {
      tbody.appendChild(createCategoryRow(cat, state));
    }

    // Total row
    tbody.appendChild(createTotalRow(state));

    table.appendChild(tbody);
    rootEl.appendChild(table);
  }

  /**
   * Creates a table row for a scoring category.
   * @param {string} categoryId
   * @param {object} state
   * @returns {HTMLTableRowElement}
   */
  function createCategoryRow(categoryId, state) {
    const tr = document.createElement('tr');
    tr.className = 'scoreboard__row';

    const th = document.createElement('th');
    th.className = 'scoreboard__category';
    th.setAttribute('scope', 'row');
    th.textContent = t('kniffel.' + categoryId);
    tr.appendChild(th);

    const currentPlayerId = state.players[state.currentPlayerIndex]?.id;
    let rowIsClickable = false;
    let rowScore = null;

    for (const player of state.players) {
      const td = document.createElement('td');
      td.className = 'scoreboard__cell';

      const sheet = state.scores[player.id];
      const value = sheet?.categories?.[categoryId];

      if (value != null) {
        td.textContent = String(value);
        td.classList.add('scoreboard__cell--filled');
      } else if (player.id === currentPlayerId && state.rollsThisTurn > 0) {
        td.classList.add('scoreboard__cell--available');
        const score = calculatePotentialScore(categoryId, state);
        td.textContent = score != null ? String(score) : '–';
        rowIsClickable = true;
        rowScore = score ?? 0;
      } else {
        td.textContent = '–';
        td.classList.add('scoreboard__cell--empty');
      }

      tr.appendChild(td);
    }

    // Make entire row clickable
    if (rowIsClickable) {
      tr.classList.add('scoreboard__row--clickable');
      tr.setAttribute('role', 'button');
      tr.setAttribute('tabindex', '0');
      tr.setAttribute('aria-label', `${t('kniffel.' + categoryId)}: ${rowScore}`);
      const handler = () => {
        if (categoryHandler) {
          categoryHandler({ id: categoryId, name: 'kniffel.' + categoryId, score: rowScore });
        }
      };
      tr.addEventListener('click', handler);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
    }

    return tr;
  }

  /**
   * Creates the upper bonus row.
   * @param {object} state
   * @returns {HTMLTableRowElement}
   */
  function createBonusRow(state) {
    const tr = document.createElement('tr');
    tr.className = 'scoreboard__row scoreboard__row--bonus';

    const th = document.createElement('th');
    th.className = 'scoreboard__category';
    th.setAttribute('scope', 'row');
    th.textContent = t('kniffel.upperBonus');
    tr.appendChild(th);

    for (const player of state.players) {
      const td = document.createElement('td');
      td.className = 'scoreboard__cell';
      const sheet = state.scores[player.id];
      const bonus = sheet?.categories?.upperBonus;
      td.textContent = bonus != null ? String(bonus) : '–';
      tr.appendChild(td);
    }

    return tr;
  }

  /**
   * Creates a section subtotal row (e.g. upper block total).
   * @param {string} labelKey - i18n key
   * @param {object} state
   * @param {string[]} categories - categories to sum
   * @returns {HTMLTableRowElement}
   */
  function createSectionRow(labelKey, state, categories) {
    const tr = document.createElement('tr');
    tr.className = 'scoreboard__row scoreboard__row--section';

    const th = document.createElement('th');
    th.className = 'scoreboard__category scoreboard__category--section';
    th.setAttribute('scope', 'row');
    th.textContent = t(labelKey);
    tr.appendChild(th);

    for (const player of state.players) {
      const td = document.createElement('td');
      td.className = 'scoreboard__cell scoreboard__cell--section';
      const sheet = state.scores[player.id];
      let sum = 0;
      if (sheet?.categories) {
        for (const cat of categories) {
          if (sheet.categories[cat] != null) {
            sum += sheet.categories[cat];
          }
        }
      }
      td.textContent = String(sum);
      tr.appendChild(td);
    }

    return tr;
  }

  /**
   * Creates the total score row.
   * @param {object} state
   * @returns {HTMLTableRowElement}
   */
  function createTotalRow(state) {
    const tr = document.createElement('tr');
    tr.className = 'scoreboard__row scoreboard__row--total';

    const th = document.createElement('th');
    th.className = 'scoreboard__category scoreboard__category--total';
    th.setAttribute('scope', 'row');
    th.textContent = t('scoreboard.total');
    tr.appendChild(th);

    for (const player of state.players) {
      const td = document.createElement('td');
      td.className = 'scoreboard__cell scoreboard__cell--total';
      const sheet = state.scores[player.id];
      td.textContent = String(sheet?.totalScore ?? 0);
      tr.appendChild(td);
    }

    return tr;
  }

  /**
   * Calculates the potential score for a category using the mode's scoring strategy.
   * Falls back to null if not calculable.
   * @param {string} categoryId
   * @param {object} state
   * @returns {number|null}
   */
  function calculatePotentialScore(categoryId, state) {
    if (!state.dice?.values || state.dice.values.every((v) => v === 0)) {
      return null;
    }
    // Import scoring inline from kniffel module would create circular dep,
    // so we use a simple inline calculation matching kniffel rules.
    const dice = state.dice.values;
    const counts = new Map();
    for (const v of dice) {
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    const maxCount = Math.max(...counts.values());
    const uniqueSorted = [...new Set(dice)].sort((a, b) => a - b);
    const sumAll = dice.reduce((a, b) => a + b, 0);

    switch (categoryId) {
      case 'ones': return (counts.get(1) || 0) * 1;
      case 'twos': return (counts.get(2) || 0) * 2;
      case 'threes': return (counts.get(3) || 0) * 3;
      case 'fours': return (counts.get(4) || 0) * 4;
      case 'fives': return (counts.get(5) || 0) * 5;
      case 'sixes': return (counts.get(6) || 0) * 6;
      case 'threeOfAKind': return maxCount >= 3 ? sumAll : 0;
      case 'fourOfAKind': return maxCount >= 4 ? sumAll : 0;
      case 'fullHouse': {
        const vals = [...counts.values()].sort();
        return vals.length === 2 && vals[0] === 2 && vals[1] === 3 ? 25 : 0;
      }
      case 'smallStraight': return hasConsecutive(uniqueSorted, 4) ? 30 : 0;
      case 'largeStraight': return hasConsecutive(uniqueSorted, 5) ? 40 : 0;
      case 'kniffel': return maxCount === 5 ? 50 : 0;
      case 'chance': return sumAll;
      default: return null;
    }
  }

  /**
   * Checks if sorted unique values contain n consecutive numbers.
   * @param {number[]} sorted
   * @param {number} n
   * @returns {boolean}
   */
  function hasConsecutive(sorted, n) {
    if (sorted.length < n) return false;
    let consecutive = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) {
        consecutive++;
        if (consecutive >= n) return true;
      } else {
        consecutive = 1;
      }
    }
    return false;
  }

  return { mount, update, destroy, onCategorySelect };
}

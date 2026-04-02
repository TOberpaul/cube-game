/**
 * Dice Announcer — ARIA-Live-Region für Würfelergebnisse.
 * Validates: Requirements 10.3
 */

import { t } from '../i18n.js';

/**
 * Announces dice result to screenreaders via ARIA live region.
 * @param {number[]} values - Array of dice values (e.g. [3, 5, 1, 6, 2])
 */
export function announceDiceResult(values) {
  const announcer = document.getElementById('dice-announcer');
  if (!announcer) return;

  const text = t('dice.result', { values: values.join(', ') });
  announcer.textContent = text;
}

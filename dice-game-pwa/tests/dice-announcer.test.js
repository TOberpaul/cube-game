// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadMessages } from '../js/i18n.js';
import { announceDiceResult } from '../js/dice/dice-announcer.js';

describe('Dice Announcer', () => {
  let announcer;

  beforeEach(() => {
    loadMessages({ 'dice.result': 'Würfelergebnis: {values}' });
    announcer = document.createElement('div');
    announcer.id = 'dice-announcer';
    document.body.appendChild(announcer);
  });

  afterEach(() => {
    announcer.remove();
  });

  it('sets textContent with all dice values', () => {
    announceDiceResult([3, 5, 1, 6, 2]);
    expect(announcer.textContent).toBe('Würfelergebnis: 3, 5, 1, 6, 2');
  });

  it('works with a single die', () => {
    announceDiceResult([4]);
    expect(announcer.textContent).toBe('Würfelergebnis: 4');
  });

  it('does nothing when announcer element is missing', () => {
    announcer.remove();
    // Should not throw
    expect(() => announceDiceResult([1, 2, 3])).not.toThrow();
  });
});

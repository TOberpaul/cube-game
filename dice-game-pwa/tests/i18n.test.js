import { describe, it, expect, beforeEach } from 'vitest';
import { t, loadMessages, getLocale } from '../js/i18n.js';

describe('i18n System', () => {
  const testMessages = {
    'app.title': 'Dice Game',
    'game.round': 'Runde {current} / {max}',
    'result.winner': '{name} gewinnt!',
    'lobby.playerCount': '{current} / {max} Spieler',
    'game.dieValue': 'Würfel {index}: {value}',
    'simple.key': 'Einfacher Text',
    'repeated.placeholder': '{name} und {name} spielen',
  };

  beforeEach(() => {
    loadMessages(testMessages, 'de');
  });

  it('returns the translated string for a known key', () => {
    expect(t('app.title')).toBe('Dice Game');
    expect(t('simple.key')).toBe('Einfacher Text');
  });

  it('falls back to the key string when key is not found', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key');
    expect(t('another.missing')).toBe('another.missing');
  });

  it('replaces single placeholder', () => {
    expect(t('result.winner', { name: 'Alice' })).toBe('Alice gewinnt!');
  });

  it('replaces multiple different placeholders', () => {
    expect(t('game.round', { current: 3, max: 13 })).toBe('Runde 3 / 13');
    expect(t('game.dieValue', { index: 2, value: 5 })).toBe('Würfel 2: 5');
  });

  it('replaces repeated placeholders of the same name', () => {
    expect(t('repeated.placeholder', { name: 'Bob' })).toBe('Bob und Bob spielen');
  });

  it('returns translated string unchanged when no params provided for a string with placeholders', () => {
    expect(t('game.round')).toBe('Runde {current} / {max}');
  });

  it('handles numeric param values', () => {
    expect(t('lobby.playerCount', { current: 2, max: 8 })).toBe('2 / 8 Spieler');
  });

  it('getLocale returns the current locale', () => {
    expect(getLocale()).toBe('de');
    loadMessages({}, 'en');
    expect(getLocale()).toBe('en');
  });

  it('loadMessages replaces previous messages', () => {
    expect(t('app.title')).toBe('Dice Game');
    loadMessages({ 'app.title': 'New Title' });
    expect(t('app.title')).toBe('New Title');
    // Old keys should no longer exist
    expect(t('simple.key')).toBe('simple.key');
  });
});

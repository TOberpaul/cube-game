import { describe, it, expect } from 'vitest';
import { parseHash, buildHash, type Route } from './useHashRouter';

// --- parseHash tests ---

describe('parseHash', () => {
  it('returns home route for empty string', () => {
    expect(parseHash('')).toEqual({ route: 'home', params: {} });
  });

  it('returns home route for bare "#"', () => {
    expect(parseHash('#')).toEqual({ route: 'home', params: {} });
  });

  it('parses a simple route without params', () => {
    expect(parseHash('#game')).toEqual({ route: 'game', params: {} });
  });

  it('parses route with query parameters', () => {
    const result = parseHash('#game?modeId=kniffel&playType=solo');
    expect(result).toEqual({
      route: 'game',
      params: { modeId: 'kniffel', playType: 'solo' },
    });
  });

  it('falls back to home for unknown routes', () => {
    expect(parseHash('#unknown')).toEqual({ route: 'home', params: {} });
    expect(parseHash('#settings')).toEqual({ route: 'home', params: {} });
    expect(parseHash('#lobby')).toEqual({ route: 'lobby', params: {} });
    expect(parseHash('#join')).toEqual({ route: 'home', params: {} });
    expect(parseHash('#answer')).toEqual({ route: 'home', params: {} });
  });

  it('parses all valid routes', () => {
    const routes: Route[] = ['home', 'game', 'result'];
    for (const route of routes) {
      expect(parseHash(`#${route}`).route).toBe(route);
    }
  });
});

// --- buildHash tests ---

describe('buildHash', () => {
  it('builds hash for route without params', () => {
    expect(buildHash('home')).toBe('#home');
  });

  it('builds hash with params', () => {
    const hash = buildHash('game', { modeId: 'kniffel', playType: 'solo' });
    expect(hash).toBe('#game?modeId=kniffel&playType=solo');
  });

  it('omits empty params', () => {
    expect(buildHash('home', {})).toBe('#home');
  });

  it('omits params with empty string values', () => {
    expect(buildHash('home', { role: '' })).toBe('#home');
  });
});

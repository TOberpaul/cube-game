import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { createGameStore } from '../js/store/game-store.js';

function makeState(overrides = {}) {
  return {
    gameId: overrides.gameId ?? 'game-1',
    modeId: 'kniffel',
    status: overrides.status ?? 'playing',
    players: [{ id: 'p1', name: 'Alice', connectionStatus: 'connected', isHost: true }],
    currentPlayerIndex: 0,
    currentRound: 1,
    maxRounds: 13,
    dice: { values: [1, 2, 3, 4, 5], held: [false, false, false, false, false], count: 5 },
    rollsThisTurn: 0,
    scores: {},
    createdAt: Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
  };
}

describe('GameStore (IndexedDB)', () => {
  let store;

  beforeEach(async () => {
    store = await createGameStore();
  });

  afterEach(() => {
    // Clean up IndexedDB between tests
    indexedDB._databases?.clear?.();
  });

  it('save() and load() round-trip', async () => {
    const state = makeState();
    await store.save(state);
    const loaded = await store.load('game-1');
    expect(loaded).toEqual(state);
  });

  it('load() returns null for non-existent game', async () => {
    const result = await store.load('does-not-exist');
    expect(result).toBeNull();
  });

  it('save() upserts (put) existing game', async () => {
    const state = makeState();
    await store.save(state);

    const updated = { ...state, currentRound: 5, updatedAt: Date.now() + 1000 };
    await store.save(updated);

    const loaded = await store.load('game-1');
    expect(loaded.currentRound).toBe(5);
  });

  it('delete() removes a game', async () => {
    await store.save(makeState());
    await store.delete('game-1');
    const loaded = await store.load('game-1');
    expect(loaded).toBeNull();
  });

  it('delete() is a no-op for non-existent game', async () => {
    // Should not throw
    await store.delete('nope');
  });

  it('listActive() returns only non-finished games sorted by updatedAt desc', async () => {
    const g1 = makeState({ gameId: 'g1', status: 'playing', updatedAt: 100 });
    const g2 = makeState({ gameId: 'g2', status: 'finished', updatedAt: 200 });
    const g3 = makeState({ gameId: 'g3', status: 'lobby', updatedAt: 300 });
    const g4 = makeState({ gameId: 'g4', status: 'playing', updatedAt: 50 });

    await store.save(g1);
    await store.save(g2);
    await store.save(g3);
    await store.save(g4);

    const active = await store.listActive();
    expect(active).toHaveLength(3);
    expect(active[0].gameId).toBe('g3');
    expect(active[1].gameId).toBe('g1');
    expect(active[2].gameId).toBe('g4');
    // g2 (finished) should not appear
    expect(active.find((g) => g.gameId === 'g2')).toBeUndefined();
  });

  it('listActive() returns empty array when no games', async () => {
    const active = await store.listActive();
    expect(active).toEqual([]);
  });

  it('listActive() returns empty when all games are finished', async () => {
    await store.save(makeState({ gameId: 'g1', status: 'finished' }));
    await store.save(makeState({ gameId: 'g2', status: 'finished' }));
    const active = await store.listActive();
    expect(active).toEqual([]);
  });
});

describe('GameStore (localStorage fallback)', () => {
  let store;
  let originalIndexedDB;
  let lsData;

  beforeEach(async () => {
    // Save and remove indexedDB to force localStorage fallback
    originalIndexedDB = globalThis.indexedDB;
    delete globalThis.indexedDB;

    // Provide a simple in-memory localStorage mock on globalThis
    lsData = {};
    globalThis.localStorage = {
      getItem: (key) => (key in lsData ? lsData[key] : null),
      setItem: (key, value) => { lsData[key] = String(value); },
      removeItem: (key) => { delete lsData[key]; },
      clear: () => { lsData = {}; },
    };

    store = await createGameStore();
  });

  afterEach(() => {
    globalThis.indexedDB = originalIndexedDB;
    delete globalThis.localStorage;
  });

  it('save() and load() round-trip via localStorage', async () => {
    const state = makeState();
    await store.save(state);
    const loaded = await store.load('game-1');
    expect(loaded).toEqual(state);
  });

  it('load() returns null for non-existent game', async () => {
    const result = await store.load('nope');
    expect(result).toBeNull();
  });

  it('save() upserts existing game', async () => {
    const state = makeState();
    await store.save(state);
    const updated = { ...state, currentRound: 7 };
    await store.save(updated);
    const loaded = await store.load('game-1');
    expect(loaded.currentRound).toBe(7);
  });

  it('delete() removes a game from localStorage', async () => {
    await store.save(makeState());
    await store.delete('game-1');
    expect(await store.load('game-1')).toBeNull();
  });

  it('listActive() filters and sorts correctly', async () => {
    await store.save(makeState({ gameId: 'a', status: 'playing', updatedAt: 10 }));
    await store.save(makeState({ gameId: 'b', status: 'finished', updatedAt: 20 }));
    await store.save(makeState({ gameId: 'c', status: 'lobby', updatedAt: 30 }));

    const active = await store.listActive();
    expect(active).toHaveLength(2);
    expect(active[0].gameId).toBe('c');
    expect(active[1].gameId).toBe('a');
  });
});

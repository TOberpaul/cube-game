import { describe, it, expect } from 'vitest';
import { createDiceEngine } from '../js/dice/dice-engine.js';

describe('DiceEngine', () => {
  it('roll() returns correct number of values', () => {
    const engine = createDiceEngine();
    const result = engine.roll(5, new Set());
    expect(result.values).toHaveLength(5);
    expect(result.rolledIndices).toHaveLength(5);
  });

  it('all rolled values are between 1 and 6', () => {
    const engine = createDiceEngine();
    const result = engine.roll(6, new Set());
    for (const v of result.values) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it('held dice keep their values', () => {
    const engine = createDiceEngine();
    const first = engine.roll(5, new Set());
    const heldIndices = new Set([0, 2, 4]);
    const second = engine.roll(5, heldIndices);

    // Held dice must retain their values from the first roll
    expect(second.values[0]).toBe(first.values[0]);
    expect(second.values[2]).toBe(first.values[2]);
    expect(second.values[4]).toBe(first.values[4]);

    // rolledIndices should only contain non-held indices
    expect(second.rolledIndices).toEqual([1, 3]);
  });

  it('roll with all dice held returns no rolled indices', () => {
    const engine = createDiceEngine();
    engine.roll(3, new Set());
    const result = engine.roll(3, new Set([0, 1, 2]));
    expect(result.rolledIndices).toEqual([]);
  });

  it('getState() returns current state', () => {
    const engine = createDiceEngine();
    engine.roll(4, new Set());
    const state = engine.getState();
    expect(state.values).toHaveLength(4);
    expect(state.count).toBe(4);
    expect(state.held).toBeInstanceOf(Set);
    expect(state.held.size).toBe(0);
  });

  it('toggleHold() toggles hold state', () => {
    const engine = createDiceEngine();
    engine.roll(3, new Set());

    engine.toggleHold(1);
    expect(engine.getState().held.has(1)).toBe(true);

    engine.toggleHold(1);
    expect(engine.getState().held.has(1)).toBe(false);
  });

  it('toggleHold() ignores out-of-range indices', () => {
    const engine = createDiceEngine();
    engine.roll(3, new Set());
    engine.toggleHold(-1);
    engine.toggleHold(5);
    expect(engine.getState().held.size).toBe(0);
  });

  it('reset() clears all state', () => {
    const engine = createDiceEngine();
    engine.roll(5, new Set());
    engine.toggleHold(0);
    engine.reset(3);

    const state = engine.getState();
    expect(state.count).toBe(3);
    expect(state.values).toHaveLength(3);
    expect(state.values.every(v => v === 0)).toBe(true);
    expect(state.held.size).toBe(0);
  });

  it('getState() returns copies (not references)', () => {
    const engine = createDiceEngine();
    engine.roll(3, new Set());
    const state1 = engine.getState();
    const state2 = engine.getState();
    expect(state1.values).not.toBe(state2.values);
    expect(state1.held).not.toBe(state2.held);
  });

  it('works with Math.random fallback', () => {
    const engine = createDiceEngine({ useCrypto: false });
    const result = engine.roll(5, new Set());
    expect(result.values).toHaveLength(5);
    for (const v of result.values) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Smoke Test', () => {
  it('vitest runs correctly', () => {
    expect(1 + 1).toBe(2);
  });

  it('jsdom environment is available', () => {
    const div = document.createElement('div');
    div.textContent = 'hello';
    document.body.appendChild(div);
    expect(document.body.textContent).toContain('hello');
    document.body.removeChild(div);
  });

  it('fast-check is available and runs property tests', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), (value) => {
        return value >= 1 && value <= 6;
      }),
      { numRuns: 100 }
    );
  });
});

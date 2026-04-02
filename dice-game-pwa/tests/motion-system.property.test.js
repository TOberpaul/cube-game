// Feature: dice-game-pwa, Property 9: Reduced Motion deaktiviert Animationen
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// Mock motion.dev's animate function
const mockFinished = Promise.resolve();
const mockAnimation = { finished: mockFinished };
vi.mock('motion', () => ({
  animate: vi.fn(() => mockAnimation),
}));

import { presets, animate } from '../js/motion/motion-system.js';
import { animate as motionAnimate } from 'motion';

/**
 * **Validates: Requirements 2.4**
 *
 * Property 9: Reduced Motion deaktiviert Animationen
 * For every preset: when shouldReduceMotion() is true,
 * the effective duration passed to motion.dev is 0 and
 * spring parameters (type, stiffness, damping, mass) are stripped.
 */
describe('Property 9: Reduced Motion deaktiviert Animationen', () => {
  const presetNames = Object.keys(presets);

  beforeEach(() => {
    // Mock matchMedia to always report prefers-reduced-motion: reduce
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    vi.clearAllMocks();
  });

  it('for every preset, animate() passes duration: 0 and no spring params to motion.dev', () => {
    const presetNameArb = fc.constantFrom(...presetNames);

    fc.assert(
      fc.property(presetNameArb, (presetName) => {
        const el = document.createElement('div');
        const keyframes = { opacity: [0, 1] };
        const config = { ...presets[presetName] };

        animate(el, keyframes, config);

        // motion.dev's animate must have been called
        expect(motionAnimate).toHaveBeenCalled();

        const lastCall = motionAnimate.mock.calls[motionAnimate.mock.calls.length - 1];
        const options = lastCall[2];

        // Effective duration must be 0
        expect(options.duration).toBe(0);

        // Spring parameters must be stripped
        expect(options.type).toBeUndefined();
        expect(options.stiffness).toBeUndefined();
        expect(options.damping).toBeUndefined();
        expect(options.mass).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});

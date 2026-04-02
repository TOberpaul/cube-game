import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock motion.dev's animate function
const mockFinished = Promise.resolve();
const mockAnimation = { finished: mockFinished };
vi.mock('motion', () => ({
  animate: vi.fn(() => mockAnimation),
}));

import { presets, animate, shouldReduceMotion, transition } from '../js/motion/motion-system.js';
import { animate as motionAnimate } from 'motion';

describe('Motion System', () => {
  let matchMediaMock;

  beforeEach(() => {
    matchMediaMock = vi.fn().mockReturnValue({ matches: false });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    });
    vi.clearAllMocks();
  });

  describe('presets', () => {
    it('should define all required preset keys', () => {
      const expectedKeys = [
        'fadeIn', 'fadeOut', 'scaleIn',
        'slideUp', 'slideDown', 'diceRoll', 'diceBounce',
      ];
      expect(Object.keys(presets)).toEqual(expect.arrayContaining(expectedKeys));
      expect(Object.keys(presets)).toHaveLength(expectedKeys.length);
    });

    it('should have duration on standard presets', () => {
      expect(presets.fadeIn.duration).toBeGreaterThan(0);
      expect(presets.fadeOut.duration).toBeGreaterThan(0);
      expect(presets.scaleIn.duration).toBeGreaterThan(0);
      expect(presets.slideUp.duration).toBeGreaterThan(0);
      expect(presets.slideDown.duration).toBeGreaterThan(0);
    });

    it('should use spring type for dice presets', () => {
      expect(presets.diceRoll.type).toBe('spring');
      expect(presets.diceRoll.stiffness).toBeGreaterThan(0);
      expect(presets.diceRoll.damping).toBeGreaterThan(0);

      expect(presets.diceBounce.type).toBe('spring');
      expect(presets.diceBounce.stiffness).toBeGreaterThan(0);
      expect(presets.diceBounce.damping).toBeGreaterThan(0);
    });
  });

  describe('shouldReduceMotion()', () => {
    it('should return false when prefers-reduced-motion is not reduce', () => {
      matchMediaMock.mockReturnValue({ matches: false });
      expect(shouldReduceMotion()).toBe(false);
    });

    it('should return true when prefers-reduced-motion is reduce', () => {
      matchMediaMock.mockReturnValue({ matches: true });
      expect(shouldReduceMotion()).toBe(true);
    });

    it('should query the correct media query', () => {
      shouldReduceMotion();
      expect(matchMediaMock).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    });
  });

  describe('animate()', () => {
    it('should call motion.dev animate with element, keyframes, and config', () => {
      const el = document.createElement('div');
      const keyframes = { opacity: [0, 1] };
      const config = { duration: 0.5 };

      animate(el, keyframes, config);

      expect(motionAnimate).toHaveBeenCalledWith(el, keyframes, expect.objectContaining({ duration: 0.5 }));
    });

    it('should set duration to 0 when reduced motion is active', () => {
      matchMediaMock.mockReturnValue({ matches: true });
      const el = document.createElement('div');

      animate(el, { opacity: [0, 1] }, { duration: 0.5 });

      expect(motionAnimate).toHaveBeenCalledWith(
        el,
        { opacity: [0, 1] },
        expect.objectContaining({ duration: 0 })
      );
    });

    it('should strip spring config when reduced motion is active', () => {
      matchMediaMock.mockReturnValue({ matches: true });
      const el = document.createElement('div');

      animate(el, { rotateX: [0, 360] }, { ...presets.diceRoll });

      const calledOptions = motionAnimate.mock.calls[0][2];
      expect(calledOptions.duration).toBe(0);
      expect(calledOptions.type).toBeUndefined();
      expect(calledOptions.stiffness).toBeUndefined();
      expect(calledOptions.damping).toBeUndefined();
    });

    it('should work with empty config', () => {
      const el = document.createElement('div');
      animate(el, { opacity: [0, 1] });
      expect(motionAnimate).toHaveBeenCalled();
    });
  });

  describe('transition()', () => {
    let outEl, inEl;

    beforeEach(() => {
      outEl = document.createElement('div');
      inEl = document.createElement('div');
      inEl.style.display = 'none';
      document.body.appendChild(outEl);
      document.body.appendChild(inEl);
    });

    afterEach(() => {
      outEl.remove();
      inEl.remove();
    });

    it('should perform a fade transition by default', async () => {
      await transition(outEl, inEl);

      // Should have called animate twice (out + in)
      expect(motionAnimate).toHaveBeenCalledTimes(2);

      // First call: fade out
      expect(motionAnimate.mock.calls[0][1]).toEqual({ opacity: [1, 0] });
      // Second call: fade in
      expect(motionAnimate.mock.calls[1][1]).toEqual({ opacity: [0, 1] });
    });

    it('should perform a slide transition', async () => {
      await transition(outEl, inEl, 'slide');

      expect(motionAnimate).toHaveBeenCalledTimes(2);

      // First call: slide out left
      expect(motionAnimate.mock.calls[0][1]).toEqual({ x: [0, -30], opacity: [1, 0] });
      // Second call: slide in from right
      expect(motionAnimate.mock.calls[1][1]).toEqual({ x: [30, 0], opacity: [0, 1] });
    });

    it('should hide outElement and show inElement', async () => {
      await transition(outEl, inEl, 'fade');

      expect(outEl.style.display).toBe('none');
      expect(inEl.style.display).toBe('');
    });

    it('should use duration 0 when reduced motion is active', async () => {
      matchMediaMock.mockReturnValue({ matches: true });

      await transition(outEl, inEl, 'fade');

      const outOptions = motionAnimate.mock.calls[0][2];
      const inOptions = motionAnimate.mock.calls[1][2];
      expect(outOptions.duration).toBe(0);
      expect(inOptions.duration).toBe(0);
    });
  });
});

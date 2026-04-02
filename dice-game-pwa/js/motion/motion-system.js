// Motion System — Wrapper around motion.dev with animation presets
// Validates: Requirements 2.1, 2.2, 2.3, 2.4

import { animate as motionAnimate } from 'motion';

/**
 * Predefined animation presets.
 * Spring-based configs for dice animations, standard configs for UI transitions.
 */
export const presets = {
  fadeIn: {
    opacity: [0, 1],
    duration: 0.3,
    easing: 'ease-out',
  },
  fadeOut: {
    opacity: [1, 0],
    duration: 0.3,
    easing: 'ease-in',
  },
  scaleIn: {
    scale: [0.8, 1],
    opacity: [0, 1],
    duration: 0.35,
    easing: 'ease-out',
  },
  slideUp: {
    y: [20, 0],
    opacity: [0, 1],
    duration: 0.35,
    easing: 'ease-out',
  },
  slideDown: {
    y: [0, 20],
    opacity: [1, 0],
    duration: 0.35,
    easing: 'ease-in',
  },
  diceRoll: {
    type: 'spring',
    stiffness: 300,
    damping: 20,
    mass: 1.2,
    duration: 0.8,
  },
  diceBounce: {
    type: 'spring',
    stiffness: 500,
    damping: 15,
    mass: 0.8,
    duration: 0.5,
  },
};

/**
 * Checks if the user prefers reduced motion.
 * @returns {boolean} true if prefers-reduced-motion: reduce is active
 */
export function shouldReduceMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Resolves animation options, applying reduced motion override when needed.
 * Extracts keyframes from preset if a preset object is used.
 * @param {object} keyframes - CSS properties to animate
 * @param {object} [config] - Animation config (or a preset object)
 * @returns {{ keyframes: object, options: object }}
 */
function resolveConfig(keyframes, config) {
  const options = { ...config };

  if (shouldReduceMotion()) {
    options.duration = 0;
    // Remove spring type so duration: 0 takes effect
    delete options.type;
    delete options.stiffness;
    delete options.damping;
    delete options.mass;
  }

  return { keyframes, options };
}

/**
 * Animates an element with motion.dev.
 * @param {HTMLElement} element - DOM element to animate
 * @param {object} keyframes - CSS keyframes (e.g. { opacity: [0, 1] })
 * @param {object} [config={}] - Animation config (duration, easing, spring params)
 * @returns {Animation} The motion.dev animation instance
 */
export function animate(element, keyframes, config = {}) {
  const { keyframes: resolvedKeyframes, options } = resolveConfig(keyframes, config);
  return motionAnimate(element, resolvedKeyframes, options);
}

/**
 * Performs a screen transition between two elements.
 * @param {HTMLElement} outElement - Element to transition out
 * @param {HTMLElement} inElement - Element to transition in
 * @param {'slide' | 'fade'} type - Transition type
 * @returns {Promise<void>}
 */
export async function transition(outElement, inElement, type = 'fade') {
  const reducedMotion = shouldReduceMotion();
  const duration = reducedMotion ? 0 : 0.3;

  if (type === 'slide') {
    // Slide out to the left, slide in from the right
    const outAnim = motionAnimate(
      outElement,
      { x: [0, -30], opacity: [1, 0] },
      { duration, easing: 'ease-in' }
    );

    await outAnim.finished;
    outElement.style.display = 'none';
    inElement.style.display = '';

    const inAnim = motionAnimate(
      inElement,
      { x: [30, 0], opacity: [0, 1] },
      { duration, easing: 'ease-out' }
    );

    await inAnim.finished;
  } else {
    // Fade transition
    const outAnim = motionAnimate(
      outElement,
      { opacity: [1, 0] },
      { duration, easing: 'ease-in' }
    );

    await outAnim.finished;
    outElement.style.display = 'none';
    inElement.style.display = '';

    const inAnim = motionAnimate(
      inElement,
      { opacity: [0, 1] },
      { duration, easing: 'ease-out' }
    );

    await inAnim.finished;
  }
}

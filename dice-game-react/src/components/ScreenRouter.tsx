import { useRef, useEffect, useCallback, useState, useSyncExternalStore, type ComponentType } from 'react';
import { useHashRouter, type Route } from '../hooks/useHashRouter';
import HomeScreen from '../screens/HomeScreen';
import GameScreen from '../screens/GameScreen';
import ResultScreen from '../screens/ResultScreen';
import LobbyScreen from '../screens/LobbyScreen';

const SCREEN_MAP: Record<Route, ComponentType> = {
  home: HomeScreen,
  game: GameScreen,
  result: ResultScreen,
  lobby: LobbyScreen,
};

/** Duration of the fade transition in ms. */
const FADE_DURATION_MS = 200;

/**
 * Returns the MediaQueryList for prefers-reduced-motion, or null in SSR.
 */
function getReducedMotionQuery(): MediaQueryList | null {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-reduced-motion: reduce)');
  }
  return null;
}

/**
 * Checks if the user prefers reduced motion.
 * Validates: Requirements 11.3
 */
export function shouldReduceMotion(): boolean {
  return getReducedMotionQuery()?.matches ?? false;
}

/**
 * React hook that reactively tracks the `prefers-reduced-motion` media query.
 * Re-renders the component when the user toggles reduced motion in OS settings.
 * Validates: Requirements 11.3
 */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mql = getReducedMotionQuery();
      mql?.addEventListener('change', callback);
      return () => mql?.removeEventListener('change', callback);
    },
    () => shouldReduceMotion(),
    () => false, // server snapshot
  );
}

/**
 * Focus the first `<h1>`, `<h2>`, or first focusable element inside a container.
 * Validates: Requirements 3.4, 12.3
 */
function focusFirstHeadingOrFocusable(container: HTMLElement): void {
  // Try headings first
  const heading = container.querySelector<HTMLElement>('h1, h2');
  if (heading) {
    if (!heading.hasAttribute('tabindex')) {
      heading.setAttribute('tabindex', '-1');
    }
    heading.focus();
    return;
  }

  // Fall back to first focusable element
  const focusable = container.querySelector<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (focusable) {
    focusable.focus();
  }
}

/**
 * ScreenRouter — maps the current hash route to a screen component,
 * handles fade transitions on route change, and manages focus after mount.
 *
 * Uses a CSS opacity transition for the fade effect. The Motion_System's
 * `transition()` helper uses motion.dev for the same opacity animation;
 * the CSS approach achieves identical results without the extra dependency
 * and integrates more naturally with React's rendering model.
 *
 * Validates: Requirements 3.3, 3.4, 11.1, 11.3
 */
export default function ScreenRouter() {
  const { route } = useHashRouter();
  const [displayedRoute, setDisplayedRoute] = useState<Route>(route);
  const [phase, setPhase] = useState<'visible' | 'fading-out' | 'fading-in'>('visible');
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstMount = useRef(true);

  const reducedMotion = useReducedMotion();
  const fadeDuration = reducedMotion ? 0 : FADE_DURATION_MS;

  // Handle route changes with fade transition
  useEffect(() => {
    // Skip transition on first mount
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (route === displayedRoute) return;

    // Start fade-out
    setPhase('fading-out');

    const fadeOutTimer = setTimeout(() => {
      // Swap the screen component
      setDisplayedRoute(route);
      setPhase('fading-in');

      const fadeInTimer = setTimeout(() => {
        setPhase('visible');
      }, fadeDuration);

      return () => clearTimeout(fadeInTimer);
    }, fadeDuration);

    return () => clearTimeout(fadeOutTimer);
  }, [route, displayedRoute, fadeDuration]);

  // Focus management: after new screen mounts, focus first heading/focusable
  const handleFocusAfterMount = useCallback(() => {
    if (containerRef.current) {
      // Use requestAnimationFrame to ensure DOM is painted
      requestAnimationFrame(() => {
        if (containerRef.current) {
          focusFirstHeadingOrFocusable(containerRef.current);
        }
      });
    }
  }, []);

  // Trigger focus when displayedRoute changes (new screen mounted)
  useEffect(() => {
    handleFocusAfterMount();
  }, [displayedRoute, handleFocusAfterMount]);

  const ScreenComponent = SCREEN_MAP[displayedRoute];

  return (
    <div
      ref={containerRef}
      className={`screen-transition ${phase === 'fading-out' ? 'screen-transition--fading' : ''}`}
      style={fadeDuration === 0 ? { transition: 'none' } : undefined}
    >
      <ScreenComponent />
    </div>
  );
}

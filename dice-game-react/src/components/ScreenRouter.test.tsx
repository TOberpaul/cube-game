import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';

// Mock @pwa/i18n before any component imports
vi.mock('@pwa/i18n', () => ({
  setLocale: vi.fn().mockResolvedValue(undefined),
  t: (key: string) => key,
  getLocale: () => 'de',
  loadMessages: vi.fn(),
}));

// Mock @pwa/game/game-mode-registry
vi.mock('@pwa/game/game-mode-registry', () => ({
  createGameModeRegistry: () => ({
    register: vi.fn(),
    get: vi.fn(),
    getAll: () => [],
  }),
}));

// Mock @pwa/game/modes/kniffel
vi.mock('@pwa/game/modes/kniffel', () => ({
  registerKniffel: vi.fn(),
}));

// Mock @pwa/game/modes/free-roll
vi.mock('@pwa/game/modes/free-roll', () => ({
  registerFreeRoll: vi.fn(),
}));

// Mock @pwa/game/game-engine
vi.mock('@pwa/game/game-engine', () => ({
  createGameEngine: vi.fn(),
}));

// Mock @pwa/store/game-store
vi.mock('@pwa/store/game-store', () => ({
  createGameStore: vi.fn().mockResolvedValue({
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(null),
    listActive: vi.fn().mockResolvedValue([]),
    listFinished: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
  }),
}));

import ScreenRouter from './ScreenRouter';
import { GameProvider } from '../context/GameContext';

// Fade duration used in ScreenRouter
const FADE_DURATION_MS = 200;

function renderWithProviders(ui: React.ReactElement) {
  return render(<GameProvider>{ui}</GameProvider>);
}

beforeEach(() => {
  window.location.hash = '#home';
});

afterEach(() => {
  window.location.hash = '';
  vi.restoreAllMocks();
});

describe('ScreenRouter', () => {
  it('renders the HomeScreen for #home route', () => {
    window.location.hash = '#home';
    const { container } = renderWithProviders(<ScreenRouter />);
    expect(container.querySelector('h1')?.textContent).toBe('home.title');
  });

  it('renders the GameScreen for #game route', () => {
    window.location.hash = '#game';
    const { container } = renderWithProviders(<ScreenRouter />);
    expect(container.querySelector('h1')?.textContent).toBe('Spiel');
  });

  it('renders the ResultScreen for #result route', () => {
    window.location.hash = '#result';
    const { container } = renderWithProviders(<ScreenRouter />);
    expect(container.querySelector('h1')?.textContent).toBe('result.title');
  });

  it('unmounts previous screen and mounts new screen on route change', async () => {
    window.location.hash = '#home';
    const { container } = renderWithProviders(<ScreenRouter />);
    expect(container.querySelector('h1')?.textContent).toBe('home.title');

    // Change route
    act(() => {
      window.location.hash = '#game';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    // After fade-out + fade-in, the new screen should be mounted
    await waitFor(
      () => {
        expect(container.querySelector('h1')?.textContent).toBe('Spiel');
      },
      { timeout: FADE_DURATION_MS * 3 + 100 },
    );
  });

  it('applies fade-out opacity during transition', async () => {
    window.location.hash = '#home';
    const { container } = renderWithProviders(<ScreenRouter />);
    const wrapper = container.querySelector('[style]') as HTMLElement;

    // Initially visible
    expect(wrapper.style.opacity).toBe('1');

    // Trigger route change
    act(() => {
      window.location.hash = '#game';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    // During fade-out, opacity should be 0
    expect(wrapper.style.opacity).toBe('0');
  });

  it('focuses the first heading after screen mount', async () => {
    window.location.hash = '#home';
    const { container } = renderWithProviders(<ScreenRouter />);

    // Wait for requestAnimationFrame-based focus
    await waitFor(() => {
      const h1 = container.querySelector('h1');
      expect(h1).not.toBeNull();
      expect(document.activeElement).toBe(h1);
    });
  });

  it('focuses heading after route change', async () => {
    window.location.hash = '#home';
    const { container } = renderWithProviders(<ScreenRouter />);

    // Change route
    act(() => {
      window.location.hash = '#game';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    // Wait for transition + focus
    await waitFor(
      () => {
        const h1 = container.querySelector('h1');
        expect(h1?.textContent).toBe('Spiel');
        expect(document.activeElement).toBe(h1);
      },
      { timeout: FADE_DURATION_MS * 3 + 100 },
    );
  });

  it('sets tabindex=-1 on heading for focus management', async () => {
    window.location.hash = '#home';
    const { container } = renderWithProviders(<ScreenRouter />);

    await waitFor(() => {
      const h1 = container.querySelector('h1');
      expect(h1?.getAttribute('tabindex')).toBe('-1');
    });
  });

  it('skips transition animation when prefers-reduced-motion is set', async () => {
    // Mock matchMedia to return prefers-reduced-motion: reduce
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    window.location.hash = '#home';
    const { container } = renderWithProviders(<ScreenRouter />);
    const wrapper = container.querySelector('[style]') as HTMLElement;

    // With reduced motion, transition should be 'none'
    expect(wrapper.style.transition).toBe('none');

    window.matchMedia = originalMatchMedia;
  });

  it('completes route change instantly when prefers-reduced-motion is set', async () => {
    // Mock matchMedia to return prefers-reduced-motion: reduce
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    window.location.hash = '#home';
    const { container } = renderWithProviders(<ScreenRouter />);
    expect(container.querySelector('h1')?.textContent).toBe('home.title');

    // Change route — with reduced motion, transition should be instant (0ms timers)
    act(() => {
      window.location.hash = '#game';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    // The screen should swap almost immediately (0ms fade duration)
    await waitFor(
      () => {
        expect(container.querySelector('h1')?.textContent).toBe('Spiel');
      },
      { timeout: 100 },
    );

    // Opacity should remain 1 (no visible fade)
    const wrapper = container.querySelector('[style]') as HTMLElement;
    expect(wrapper.style.transition).toBe('none');

    window.matchMedia = originalMatchMedia;
  });
});

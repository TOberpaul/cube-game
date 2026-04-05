// App Bootstrap & Router — Hash-based screen navigation
// Validates: Requirements 1.1, 1.2, 9.2

import { transition } from './motion/motion-system.js';
import { setLocale } from './i18n.js';

// Screen factory imports (each exports a factory returning { mount, unmount })
import { createHomeScreen } from './screens/home-screen.js';
import { createLobbyScreen } from './screens/lobby-screen.js';
import { createGameScreen } from './screens/game-screen.js';
import { createResultScreen } from './screens/result-screen.js';

// Route → screen factory mapping
const SCREEN_FACTORIES = {
  home: createHomeScreen,
  lobby: createLobbyScreen,
  game: createGameScreen,
  result: createResultScreen,
};

const DEFAULT_ROUTE = 'home';

let currentScreen = null;
let currentRoute = null;
let currentParams = {};
let appContainer = null;

/**
 * Returns the current route parameters.
 * @returns {object} Current params (e.g. { gameId, modeId })
 */
export function getParams() {
  return { ...currentParams };
}

/**
 * Navigates to a route programmatically.
 * @param {string} route - Route name (home, lobby, game, result)
 * @param {object} [params={}] - Route parameters
 */
export function navigate(route, params = {}) {
  currentParams = { ...params };
  // Encode params into hash: #route?key=value&key2=value2
  const search = Object.keys(params).length
    ? '?' + new URLSearchParams(params).toString()
    : '';
  window.location.hash = `#${route}${search}`;
}

/**
 * Parses the current hash into { route, params }.
 */
function parseHash() {
  const hash = window.location.hash.slice(1) || DEFAULT_ROUTE;
  const [route, queryString] = hash.split('?');
  const params = {};
  if (queryString) {
    for (const [key, value] of new URLSearchParams(queryString)) {
      params[key] = value;
    }
  }
  return { route: route || DEFAULT_ROUTE, params };
}

/**
 * Moves focus to the first heading or focusable element in the new screen.
 * @param {HTMLElement} wrapper - The screen wrapper element
 */
function manageFocus(wrapper) {
  // Prefer the first heading, then first focusable element
  const target =
    wrapper.querySelector('h1, h2') ||
    wrapper.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');

  if (target) {
    // Make heading focusable temporarily if it's not natively focusable
    if (!target.getAttribute('tabindex') && !target.matches('button, [href], input, select, textarea')) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus({ preventScroll: true });
  }
}

/**
 * Handles route changes: unmounts current screen, mounts new one with transition.
 */
async function onRouteChange() {
  const { route, params } = parseHash();
  currentParams = params;

  // Skip if same route (allow param changes to re-mount)
  if (route === currentRoute && JSON.stringify(params) === JSON.stringify(getParams())) {
    return;
  }

  const factory = SCREEN_FACTORIES[route];
  if (!factory) {
    // Unknown route — fall back to home
    navigate(DEFAULT_ROUTE);
    return;
  }

  const newScreen = factory();

  // Create a wrapper element for the new screen
  const newWrapper = document.createElement('div');
  newWrapper.className = 'screen';
  newWrapper.style.display = 'none';
  appContainer.appendChild(newWrapper);

  // Mount new screen content
  newScreen.mount(newWrapper);

  if (currentScreen) {
    // Get the current screen's wrapper
    const oldWrapper = appContainer.querySelector('.screen:not(:last-child)') ||
      appContainer.firstElementChild;

    if (oldWrapper && oldWrapper !== newWrapper) {
      await transition(oldWrapper, newWrapper, 'fade');
      currentScreen.unmount();
      oldWrapper.remove();
    } else {
      newWrapper.style.display = '';
    }
  } else {
    // First screen — just show it
    newWrapper.style.display = '';
  }

  currentScreen = newScreen;
  currentRoute = route;

  // Focus management: move focus to new screen content for accessibility
  manageFocus(newWrapper);
}

/**
 * Registers the service worker for offline support.
 */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register('./sw.js');

    // Check for updates on every app start
    reg.update();

    // When a new SW is found and installed, reload to activate it
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
          // New version active — reload to get fresh assets
          window.location.reload();
        }
      });
    });
  } catch (err) {
    console.warn('Service Worker registration failed:', err);
  }
}

/**
 * App initialization.
 */
async function init() {
  appContainer = document.getElementById('app');

  // Initialize i18n with German locale
  try {
    await setLocale('de');
  } catch (err) {
    console.warn('Failed to load locale:', err);
  }

  // Register service worker
  registerServiceWorker();

  // Set default hash if none
  if (!window.location.hash || window.location.hash === '#') {
    window.location.hash = `#${DEFAULT_ROUTE}`;
  }

  // Listen for hash changes
  window.addEventListener('hashchange', onRouteChange);

  // Initial route
  await onRouteChange();
}

// Boot the app
init();

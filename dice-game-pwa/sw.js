/**
 * Service Worker — Dice Game PWA
 * Cache-First-Strategie für alle App-Assets.
 */

const CACHE_NAME = 'dice-game-v30';

// Respond to version queries from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'getVersion') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/screens.css',
  './css/foundation.css',
  './js/app.js',
  './js/i18n.js',
  './js/motion/motion-system.js',
  './js/dice/dice-engine.js',
  './js/dice/dice-renderer.js',
  './js/dice/dice-announcer.js',
  './js/game/game-engine.js',
  './js/game/game-mode-registry.js',
  './js/game/scoreboard.js',
  './js/game/modes/free-roll.js',
  './js/game/modes/kniffel.js',
  './js/multiplayer/sync-protocol.js',
  './js/multiplayer/websocket-client.js',
  './js/multiplayer/webrtc-peer.js',
  './js/multiplayer/sdp-payload.js',
  './js/multiplayer/qr-code.js',
  './js/multiplayer/offline-game-controller.js',
  './js/multiplayer/offline-session.js',
  './js/lib/three.module.js',
  './js/lib/three.core.js',
  './js/lib/three-addons/loaders/GLTFLoader.js',
  './js/lib/three-addons/utils/BufferGeometryUtils.js',
  './js/lib/three-addons/utils/SkeletonUtils.js',
  './js/store/game-store.js',
  './js/avatars.js',
  './js/screens/home-screen.js',
  './js/screens/lobby-screen.js',
  './js/screens/game-screen.js',
  './js/screens/result-screen.js',
  './js/template-loader.js',
  './templates/home.html',
  './templates/home-dialog.html',
  './templates/mode-card.html',
  './templates/player-setup.html',
  './templates/game.html',
  './templates/lobby.html',
  './templates/result.html',
  './templates/result-error.html',
  './locales/de.json',
  './assets/dice.glb'
];

// Install — cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network-first for navigation, stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
  // Navigation requests (HTML pages): always try network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // All other assets: stale-while-revalidate
  // Serve from cache immediately, but fetch fresh version in background
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (event.request.method === 'GET' && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

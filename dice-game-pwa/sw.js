/**
 * Service Worker — Dice Game PWA
 * Cache-First-Strategie für alle App-Assets.
 */

const CACHE_NAME = 'dice-game-v1';

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

// Fetch — cache-first strategy
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

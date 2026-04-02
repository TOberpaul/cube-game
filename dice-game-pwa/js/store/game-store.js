// Game Store — IndexedDB-basierte Persistenz mit localStorage-Fallback
// Feature: dice-game-pwa, Task 7.1

const DB_NAME = 'dice-game-pwa';
const DB_VERSION = 1;
const STORE_NAME = 'games';
const LS_KEY = 'dice-game-pwa-games';

/**
 * Opens the IndexedDB database, creating object store and indexes if needed.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'gameId' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Checks whether IndexedDB is available and functional.
 * @returns {Promise<boolean>}
 */
async function isIndexedDBAvailable() {
  if (typeof indexedDB === 'undefined') return false;
  try {
    const db = await openDB();
    db.close();
    return true;
  } catch {
    return false;
  }
}

// --- IndexedDB backend ---

function createIndexedDBStore(db) {
  return {
    async save(state) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(state);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },

    async load(gameId) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(gameId);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    },

    async listActive() {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
          const all = request.result || [];
          const active = all
            .filter((g) => g.status !== 'finished')
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          resolve(active);
        };
        request.onerror = () => reject(request.error);
      });
    },

    async delete(gameId) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(gameId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },
  };
}


// --- localStorage fallback backend ---

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof self !== 'undefined' && self.localStorage) return self.localStorage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  return null;
}

function getLS() {
  try {
    const storage = getStorage();
    if (!storage) return {};
    const raw = storage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLS(data) {
  const storage = getStorage();
  if (storage) {
    storage.setItem(LS_KEY, JSON.stringify(data));
  }
}

function createLocalStorageStore() {
  return {
    async save(state) {
      const data = getLS();
      data[state.gameId] = state;
      setLS(data);
    },

    async load(gameId) {
      const data = getLS();
      return data[gameId] ?? null;
    },

    async listActive() {
      const data = getLS();
      return Object.values(data)
        .filter((g) => g.status !== 'finished')
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },

    async delete(gameId) {
      const data = getLS();
      delete data[gameId];
      setLS(data);
    },
  };
}

// --- Factory ---

/**
 * Creates a GameStore instance. Uses IndexedDB when available, falls back to localStorage.
 * @returns {Promise<{save: Function, load: Function, listActive: Function, delete: Function}>}
 */
export async function createGameStore() {
  const idbAvailable = await isIndexedDBAvailable();

  if (idbAvailable) {
    const db = await openDB();
    return createIndexedDBStore(db);
  }

  return createLocalStorageStore();
}

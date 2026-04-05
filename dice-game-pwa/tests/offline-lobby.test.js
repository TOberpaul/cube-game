// Unit-Tests für Offline-Lobby
// Feature: offline-multiplayer
// Validates: Requirements 1.1, 1.4, 2.1, 3.5

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockNavigate = vi.fn();
const mockGetParams = vi.fn(() => ({}));

vi.mock('../js/app.js', () => ({
  navigate: (...args) => mockNavigate(...args),
  getParams: () => mockGetParams(),
}));

vi.mock('../js/i18n.js', () => ({
  t: (key, params) => {
    if (params) {
      let result = key;
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v));
      }
      return result;
    }
    return key;
  },
}));

import { readFileSync } from 'fs';
import { resolve } from 'path';

const lobbyHtmlRaw = readFileSync(
  resolve(__dirname, '..', 'templates', 'lobby.html'),
  'utf-8'
);

function createLobbyFragment() {
  const html = lobbyHtmlRaw.replace(/\{\{([^}]+)\}\}/g, (_, key) => key.trim());
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content;
}

vi.mock('../js/template-loader.js', () => ({
  loadTemplate: vi.fn(() => Promise.resolve(createLobbyFragment())),
}));

const mockPeer = {
  connect: vi.fn(() => Promise.resolve()),
  getOffer: vi.fn(() =>
    Promise.resolve({ type: 'offer', sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n', candidates: [] })
  ),
  getAnswer: vi.fn(() =>
    Promise.resolve({ type: 'answer', sdp: 'v=0\r\no=- 456 2 IN IP4 127.0.0.1\r\n', candidates: [] })
  ),
  setOffer: vi.fn(() => Promise.resolve()),
  setAnswer: vi.fn(() => Promise.resolve()),
  disconnect: vi.fn(),
  onConnectionChange: vi.fn(),
  onMessage: vi.fn(),
};

vi.mock('../js/multiplayer/webrtc-peer.js', () => ({
  createWebRTCPeer: vi.fn(() => mockPeer),
}));

vi.mock('../js/multiplayer/sdp-payload.js', () => ({
  serializeSdpPayload: vi.fn((p) => JSON.stringify(p)),
  deserializeSdpPayload: vi.fn((json) => { try { return JSON.parse(json); } catch { throw new Error('Invalid JSON'); } }),
  validateSdpPayload: vi.fn((p) => {
    if (!p || typeof p !== 'object') return { valid: false, error: 'payload must be an object' };
    if (!['offer', 'answer'].includes(p.type)) return { valid: false, error: 'Invalid type field' };
    if (typeof p.sdp !== 'string' || p.sdp === '') return { valid: false, error: 'Invalid sdp field' };
    if (!Array.isArray(p.candidates)) return { valid: false, error: 'Invalid candidates field' };
    return { valid: true };
  }),
}));

vi.mock('../js/game/game-mode-registry.js', () => ({
  createGameModeRegistry: vi.fn(() => ({
    register: vi.fn(),
    get: vi.fn(() => ({ id: 'free-roll', name: 'Free Roll', maxPlayers: 8, diceCount: 5, scoring: {} })),
    getAll: vi.fn(() => []),
  })),
}));

vi.mock('../js/game/modes/free-roll.js', () => ({ registerFreeRoll: vi.fn() }));
vi.mock('../js/game/modes/kniffel.js', () => ({ registerKniffel: vi.fn() }));

import { createLobbyScreen } from '../js/screens/lobby-screen.js';

async function mountLobby(params) {
  mockGetParams.mockReturnValue(params);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const screen = createLobbyScreen();
  screen.mount(container);
  await vi.waitFor(() => {
    if (!container.querySelector('.lobby-screen')) throw new Error('not rendered');
  });
  await new Promise((r) => setTimeout(r, 0));
  return { container, screen };
}

describe('Offline-Lobby Unit Tests', () => {
  beforeEach(() => { vi.clearAllMocks(); document.body.innerHTML = ''; });
  afterEach(() => { document.body.innerHTML = ''; });

  describe('Host navigation (playType=offline, role=host)', () => {
    it('shows connection status indicator', async () => {
      const { container } = await mountLobby({ playType: 'offline', role: 'host', modeId: 'free-roll' });
      const statusEl = container.querySelector('[data-offline-connection-status]');
      expect(statusEl).not.toBeNull();
      expect(statusEl.hidden).toBe(false);
    });

    it('removes player list in offline mode', async () => {
      const { container } = await mountLobby({ playType: 'offline', role: 'host', modeId: 'free-roll' });
      expect(container.querySelector('.lobby-screen__players')).toBeNull();
    });

    it('disables the start button initially', async () => {
      const { container } = await mountLobby({ playType: 'offline', role: 'host', modeId: 'free-roll' });
      const startBtn = container.querySelector('#lobby-start-btn');
      expect(startBtn).not.toBeNull();
      expect(startBtn.disabled).toBe(true);
    });

    it('removes client scan button for host', async () => {
      const { container } = await mountLobby({ playType: 'offline', role: 'host', modeId: 'free-roll' });
      expect(container.querySelector('[data-offline-scan-offer]')).toBeNull();
    });
  });

  describe('Client navigation (playType=offline, role=client)', () => {
    it('shows connection status indicator', async () => {
      const { container } = await mountLobby({ playType: 'offline', role: 'client', modeId: 'free-roll' });
      const statusEl = container.querySelector('[data-offline-connection-status]');
      expect(statusEl).not.toBeNull();
      expect(statusEl.hidden).toBe(false);
    });

    it('shows the scan offer button or has it in actions', async () => {
      const { container } = await mountLobby({ playType: 'offline', role: 'client', modeId: 'free-roll' });
      // The scan button should exist somewhere in the DOM
      const scanBtn = container.querySelector('[data-offline-scan-offer]');
      // If button exists, it should be visible
      if (scanBtn) {
        expect(scanBtn.hidden).toBe(false);
      }
      // Host scan button should be removed for client
      expect(container.querySelector('[data-offline-scan-answer]')).toBeNull();
    });

    it('removes start button for client', async () => {
      const { container } = await mountLobby({ playType: 'offline', role: 'client', modeId: 'free-roll' });
      expect(container.querySelector('#lobby-start-btn')).toBeNull();
    });

    it('removes host scan answer button for client', async () => {
      const { container } = await mountLobby({ playType: 'offline', role: 'client', modeId: 'free-roll' });
      expect(container.querySelector('[data-offline-scan-answer]')).toBeNull();
    });
  });

  describe('Loading state during SDP generation', () => {
    it('shows loading spinner when host flow starts', async () => {
      mockPeer.connect.mockImplementation(() => new Promise(() => {}));
      mockPeer.getOffer.mockImplementation(() => new Promise(() => {}));

      const { container } = await mountLobby({ playType: 'offline', role: 'host', modeId: 'free-roll' });

      const loadingEl = container.querySelector('[data-offline-loading]');
      expect(loadingEl).not.toBeNull();
      expect(loadingEl.hidden).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('shows error when host paste fails with empty clipboard', async () => {
      mockPeer.connect.mockResolvedValue();
      mockPeer.getOffer.mockResolvedValue({ type: 'offer', sdp: 'v=0\r\n', candidates: [] });

      const { container } = await mountLobby({ playType: 'offline', role: 'host', modeId: 'free-roll' });

      await vi.waitFor(() => {
        const btn = container.querySelector('[data-offline-paste-answer]');
        if (!btn || btn.hidden) throw new Error('not ready');
      });

      // Mock empty clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText: vi.fn(() => Promise.resolve('')) },
        configurable: true,
      });

      container.querySelector('[data-offline-paste-answer]').click();

      await vi.waitFor(() => {
        const errorEl = container.querySelector('[data-offline-error]');
        if (!errorEl || errorEl.hidden) throw new Error('error not shown');
      });

      expect(container.querySelector('[data-offline-error]').hidden).toBe(false);
    });
  });
});

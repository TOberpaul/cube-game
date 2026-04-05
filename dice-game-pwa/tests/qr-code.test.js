import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateQrCode,
  stopScanner,
  scanQrCode,
  QrScanError,
} from '../js/multiplayer/qr-code.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock canvas with a working getContext('2d') and toDataURL.
 */
function createMockCanvas() {
  const ctx = {
    fillStyle: '',
    fillRect: vi.fn(),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toDataURL: vi.fn(() => 'data:image/png;base64,MOCK_QR_DATA'),
  };
  return { canvas, ctx };
}

/**
 * Creates a mock MediaStream with stoppable tracks.
 */
function createMockStream() {
  const track = { stop: vi.fn() };
  return {
    getTracks: () => [track],
    _track: track,
  };
}

// ---------------------------------------------------------------------------
// generateQrCode
// ---------------------------------------------------------------------------

describe('generateQrCode', () => {
  let originalCreateElement;

  beforeEach(() => {
    originalCreateElement = document.createElement.bind(document);
  });

  afterEach(() => {
    // Restore original createElement
    document.createElement = originalCreateElement;
  });

  it('generates a valid data-URL for an SDP payload', async () => {
    const { canvas } = createMockCanvas();

    // Intercept canvas creation while letting other elements pass through
    const origCreate = document.createElement.bind(document);
    document.createElement = vi.fn((tag, options) => {
      if (tag === 'canvas') return canvas;
      return origCreate(tag, options);
    });

    const sdpPayload = JSON.stringify({
      type: 'offer',
      sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n',
      candidates: [],
    });

    const result = await generateQrCode(sdpPayload);

    expect(result).toMatch(/^data:image\/png;base64,/);
    expect(canvas.getContext).toHaveBeenCalledWith('2d');
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png');
  });

  it('throws when data is empty', async () => {
    await expect(generateQrCode('')).rejects.toThrow('data must be a non-empty string');
  });

  it('throws when data is not a string', async () => {
    await expect(generateQrCode(123)).rejects.toThrow('data must be a non-empty string');
  });
});

// ---------------------------------------------------------------------------
// stopScanner — releases camera stream
// ---------------------------------------------------------------------------

describe('stopScanner', () => {
  it('releases camera stream by stopping all tracks', async () => {
    const mockStream = createMockStream();

    // Start a scan to populate the module-level _scannerStream
    const mockVideo = document.createElement('video');
    // Make it look like an HTMLVideoElement for the instanceof check
    Object.defineProperty(mockVideo, 'play', { value: vi.fn(() => Promise.resolve()) });
    Object.defineProperty(mockVideo, 'srcObject', { value: null, writable: true });

    // Mock getUserMedia to return our mock stream
    const origMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn(() => Promise.resolve(mockStream)),
      },
      configurable: true,
    });

    // We need BarcodeDetector to not exist so it falls through to the fallback
    // which throws — but the stream is already assigned by then.
    // Instead, let's start scanQrCode and catch the error, then call stopScanner.
    try {
      await scanQrCode(mockVideo);
    } catch {
      // Expected — the fallback scanner throws QrScanError
    }

    // Now call stopScanner — it should stop the tracks
    stopScanner();

    expect(mockStream._track.stop).toHaveBeenCalled();

    // Restore
    Object.defineProperty(navigator, 'mediaDevices', {
      value: origMediaDevices,
      configurable: true,
    });
  });

  it('is safe to call when no scanner is running', () => {
    // Should not throw
    expect(() => stopScanner()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Camera error handling
// ---------------------------------------------------------------------------

describe('scanQrCode — camera errors', () => {
  let origMediaDevices;

  beforeEach(() => {
    origMediaDevices = navigator.mediaDevices;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: origMediaDevices,
      configurable: true,
    });
    stopScanner();
  });

  it('throws QrScanError with code NotAllowedError when camera access is denied', async () => {
    const notAllowed = new DOMException('Permission denied', 'NotAllowedError');
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(() => Promise.reject(notAllowed)) },
      configurable: true,
    });

    const video = document.createElement('video');

    await expect(scanQrCode(video)).rejects.toThrow(QrScanError);
    try {
      await scanQrCode(video);
    } catch (err) {
      expect(err).toBeInstanceOf(QrScanError);
      expect(err.code).toBe('NotAllowedError');
      expect(err.message).toContain('denied');
    }
  });

  it('throws QrScanError with code NotFoundError when no camera is available', async () => {
    const notFound = new DOMException('No camera', 'NotFoundError');
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(() => Promise.reject(notFound)) },
      configurable: true,
    });

    const video = document.createElement('video');

    await expect(scanQrCode(video)).rejects.toThrow(QrScanError);
    try {
      await scanQrCode(video);
    } catch (err) {
      expect(err).toBeInstanceOf(QrScanError);
      expect(err.code).toBe('NotFoundError');
      expect(err.message).toContain('not available');
    }
  });

  it('re-throws unexpected errors from getUserMedia', async () => {
    const unexpected = new Error('Something unexpected');
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(() => Promise.reject(unexpected)) },
      configurable: true,
    });

    const video = document.createElement('video');

    await expect(scanQrCode(video)).rejects.toThrow('Something unexpected');
  });

  it('throws when videoElement is not an HTMLVideoElement', async () => {
    await expect(scanQrCode(null)).rejects.toThrow('A valid HTMLVideoElement is required');
    await expect(scanQrCode(document.createElement('div'))).rejects.toThrow(
      'A valid HTMLVideoElement is required'
    );
  });
});

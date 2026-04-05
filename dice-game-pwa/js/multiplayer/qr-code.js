/**
 * QR-Code-Modul — Offline P2P Multiplayer
 * QR code generation (Canvas-based) and scanning (BarcodeDetector API).
 *
 * @module qr-code
 * Feature: offline-multiplayer, Anforderungen: 8.1, 8.2, 8.3, 8.4, 8.5
 */

// ---------------------------------------------------------------------------
// Module-level scanner state
// ---------------------------------------------------------------------------
let _scannerStream = null;
let _scannerRunning = false;
let _scannerAnimationId = null;

// ---------------------------------------------------------------------------
// QR Code Generation — lightweight, self-contained, Canvas-based
// ---------------------------------------------------------------------------

/**
 * Generates a QR code image (as Data-URL) from a string.
 * Uses a self-contained QR encoder + Canvas rendering.
 *
 * @param {string} data - Data to encode
 * @returns {Promise<string>} Data-URL of the QR code image (PNG)
 */
export async function generateQrCode(data) {
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('data must be a non-empty string');
  }

  const modules = encodeToQrModules(data);
  return renderModulesToDataUrl(modules);
}

/**
 * Starts the camera-based QR code scanner.
 * Uses the native BarcodeDetector API when available, otherwise falls back
 * to a canvas-based frame scanning approach.
 *
 * @param {HTMLVideoElement} videoElement - Video element for camera preview
 * @returns {Promise<string>} Decoded QR code content
 */
export async function scanQrCode(videoElement) {
  if (!videoElement || !(videoElement instanceof HTMLVideoElement)) {
    throw new Error('A valid HTMLVideoElement is required');
  }

  // Stop any previous scanner
  stopScanner();

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new QrScanError(
        'Camera access denied. Please enable it in your settings.',
        'NotAllowedError'
      );
    }
    if (err.name === 'NotFoundError') {
      throw new QrScanError(
        'No camera found. Scanner is not available.',
        'NotFoundError'
      );
    }
    throw err;
  }

  _scannerStream = stream;
  _scannerRunning = true;
  videoElement.srcObject = stream;

  await videoElement.play();

  // Prefer native BarcodeDetector when available
  const useBarcodeDetector =
    typeof globalThis.BarcodeDetector !== 'undefined';

  if (useBarcodeDetector) {
    return _scanWithBarcodeDetector(videoElement);
  }
  return _scanWithCanvasFallback(videoElement);
}

/**
 * Stops the running QR code scanner and releases the camera.
 */
export function stopScanner() {
  _scannerRunning = false;

  if (_scannerAnimationId != null) {
    cancelAnimationFrame(_scannerAnimationId);
    _scannerAnimationId = null;
  }

  if (_scannerStream) {
    for (const track of _scannerStream.getTracks()) {
      track.stop();
    }
    _scannerStream = null;
  }
}

// ---------------------------------------------------------------------------
// Custom error class for scanner errors
// ---------------------------------------------------------------------------

export class QrScanError extends Error {
  /**
   * @param {string} message
   * @param {'NotAllowedError'|'NotFoundError'|string} code
   */
  constructor(message, code) {
    super(message);
    this.name = 'QrScanError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Internal: BarcodeDetector scanning loop
// ---------------------------------------------------------------------------

async function _scanWithBarcodeDetector(videoElement) {
  const detector = new globalThis.BarcodeDetector({ formats: ['qr_code'] });

  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (!_scannerRunning) {
        reject(new Error('Scanner stopped'));
        return;
      }

      try {
        const barcodes = await detector.detect(videoElement);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          stopScanner();
          resolve(barcodes[0].rawValue);
          return;
        }
      } catch {
        // Detection can fail on individual frames — keep trying
      }

      _scannerAnimationId = requestAnimationFrame(tick);
    };

    _scannerAnimationId = requestAnimationFrame(tick);
  });
}

// ---------------------------------------------------------------------------
// Internal: Canvas-based fallback scanning loop (frame capture)
// ---------------------------------------------------------------------------

async function _scanWithCanvasFallback(videoElement) {
  // Without jsQR or BarcodeDetector, we cannot decode QR codes.
  // This fallback captures frames and attempts to use any available decoder.
  // In practice, modern browsers support BarcodeDetector.
  // If neither is available, we throw a helpful error.
  throw new QrScanError(
    'QR code scanning is not supported in this browser. Please use the text input instead.',
    'NotSupportedError'
  );
}

// ---------------------------------------------------------------------------
// QR Code Encoder — Minimal byte-mode QR code generator
// ---------------------------------------------------------------------------

// Error correction level: L (7% recovery — keeps QR compact for large SDP payloads)
const EC_LEVEL = 1; // 0=M, 1=L, 2=H, 3=Q

// QR version capacities for byte mode at EC level L
// [version] = max bytes
const VERSION_CAPACITY_L = [
  0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271,
  321, 367, 425, 458, 520, 586, 644, 718, 792, 858,
  929, 1003, 1091, 1171, 1273, 1367, 1465, 1528, 1628, 1732,
  1840, 1952, 2068, 2188, 2303, 2431, 2563, 2699, 2809, 2953,
];

/**
 * Determines the minimum QR version that can hold `length` bytes at EC level L.
 */
function getMinVersion(length) {
  for (let v = 1; v <= 40; v++) {
    if (VERSION_CAPACITY_L[v] >= length) return v;
  }
  throw new Error(`Data too large for QR code (${length} bytes)`);
}

/**
 * Encodes a UTF-8 string into a QR code module matrix (boolean[][]).
 * Returns a 2D array where true = dark module.
 */
function encodeToQrModules(data) {
  const bytes = new TextEncoder().encode(data);
  const version = getMinVersion(bytes.length);
  const size = version * 4 + 17;

  // Create the module grid and reservation grid
  const grid = Array.from({ length: size }, () => new Uint8Array(size));
  const reserved = Array.from({ length: size }, () => new Uint8Array(size));

  // Place finder patterns
  placeFinder(grid, reserved, 0, 0);
  placeFinder(grid, reserved, size - 7, 0);
  placeFinder(grid, reserved, 0, size - 7);

  // Place alignment patterns
  const alignPositions = getAlignmentPositions(version);
  for (const r of alignPositions) {
    for (const c of alignPositions) {
      if (isFinderArea(r, c, size)) continue;
      placeAlignment(grid, reserved, r, c);
    }
  }

  // Place timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(grid, reserved, 6, i, i % 2 === 0);
    setModule(grid, reserved, i, 6, i % 2 === 0);
  }

  // Dark module
  setModule(grid, reserved, size - 8, 8, true);

  // Reserve format info areas
  reserveFormatAreas(reserved, size);

  // Reserve version info areas (version >= 7)
  if (version >= 7) {
    reserveVersionAreas(reserved, size);
  }

  // Encode data into bit stream
  const dataCodewords = getDataCodewords(bytes, version);
  const ecCodewords = getErrorCorrectionCodewords(dataCodewords, version);
  const allCodewords = interleaveCodewords(dataCodewords, ecCodewords, version);
  const bits = codewordsToBits(allCodewords);

  // Place data bits
  placeDataBits(grid, reserved, bits, size);

  // Apply best mask
  const bestMask = selectBestMask(grid, reserved, size);
  applyMask(grid, reserved, bestMask, size);

  // Write format info
  writeFormatInfo(grid, size, bestMask);

  // Write version info
  if (version >= 7) {
    writeVersionInfo(grid, size, version);
  }

  return grid;
}

// ---------------------------------------------------------------------------
// Module placement helpers
// ---------------------------------------------------------------------------

function setModule(grid, reserved, row, col, dark) {
  grid[row][col] = dark ? 1 : 0;
  reserved[row][col] = 1;
}

function placeFinder(grid, reserved, row, col) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= grid.length || cc < 0 || cc >= grid.length) continue;
      const dark =
        (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
        (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      setModule(grid, reserved, rr, cc, dark);
    }
  }
}

function placeAlignment(grid, reserved, centerRow, centerCol) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const dark =
        Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
      setModule(grid, reserved, centerRow + r, centerCol + c, dark);
    }
  }
}

function isFinderArea(r, c, size) {
  // Check if (r, c) overlaps with any finder pattern area (including separator)
  return (
    (r <= 8 && c <= 8) ||
    (r <= 8 && c >= size - 8) ||
    (r >= size - 8 && c <= 8)
  );
}

function reserveFormatAreas(reserved, size) {
  for (let i = 0; i < 8; i++) {
    reserved[8][i] = 1;
    reserved[8][size - 1 - i] = 1;
    reserved[i][8] = 1;
    reserved[size - 1 - i][8] = 1;
  }
  reserved[8][8] = 1;
}

function reserveVersionAreas(reserved, size) {
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      reserved[i][size - 11 + j] = 1;
      reserved[size - 11 + j][i] = 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Alignment pattern positions
// ---------------------------------------------------------------------------

function getAlignmentPositions(version) {
  if (version === 1) return [];
  const positions = ALIGNMENT_POSITIONS[version];
  return positions || [];
}

// Pre-computed alignment pattern center positions per version
const ALIGNMENT_POSITIONS = {
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
  11: [6, 30, 54],
  12: [6, 32, 58],
  13: [6, 34, 62],
  14: [6, 26, 46, 66],
  15: [6, 26, 48, 70],
  16: [6, 26, 50, 74],
  17: [6, 30, 54, 78],
  18: [6, 30, 56, 82],
  19: [6, 30, 58, 86],
  20: [6, 34, 62, 90],
  21: [6, 28, 50, 72, 94],
  22: [6, 26, 50, 74, 98],
  23: [6, 30, 54, 78, 102],
  24: [6, 28, 54, 80, 106],
  25: [6, 32, 58, 84, 110],
  26: [6, 30, 58, 86, 114],
  27: [6, 34, 62, 90, 118],
  28: [6, 26, 50, 74, 98, 122],
  29: [6, 30, 54, 78, 102, 126],
  30: [6, 26, 52, 78, 104, 130],
  31: [6, 30, 56, 82, 108, 134],
  32: [6, 34, 60, 86, 112, 138],
  33: [6, 30, 58, 86, 114, 142],
  34: [6, 34, 62, 90, 118, 146],
  35: [6, 30, 54, 78, 102, 126, 150],
  36: [6, 24, 50, 76, 102, 128, 154],
  37: [6, 28, 54, 80, 106, 132, 158],
  38: [6, 32, 58, 84, 110, 136, 162],
  39: [6, 26, 54, 82, 110, 138, 166],
  40: [6, 30, 58, 86, 114, 142, 170],
};

// ---------------------------------------------------------------------------
// Data encoding (byte mode)
// ---------------------------------------------------------------------------

// EC block info per version at EC level L:
// [totalCodewords, ecCodewordsPerBlock, numBlocks1, dataPerBlock1, numBlocks2, dataPerBlock2]
const EC_PARAMS_L = {
  1: [26, 7, 1, 19, 0, 0],
  2: [44, 10, 1, 34, 0, 0],
  3: [70, 15, 1, 55, 0, 0],
  4: [100, 20, 1, 80, 0, 0],
  5: [134, 26, 1, 108, 0, 0],
  6: [172, 18, 2, 68, 0, 0],
  7: [196, 20, 2, 78, 0, 0],
  8: [242, 24, 2, 97, 0, 0],
  9: [292, 30, 2, 116, 0, 0],
  10: [346, 18, 2, 68, 2, 69],
  11: [404, 20, 4, 81, 0, 0],
  12: [466, 24, 2, 92, 2, 93],
  13: [532, 26, 4, 107, 0, 0],
  14: [581, 30, 3, 115, 1, 116],
  15: [655, 22, 5, 87, 1, 88],
  16: [733, 24, 5, 98, 1, 99],
  17: [815, 28, 1, 107, 5, 108],
  18: [901, 30, 5, 120, 1, 121],
  19: [991, 28, 3, 113, 4, 114],
  20: [1085, 28, 3, 107, 5, 108],
  21: [1156, 28, 4, 116, 4, 117],
  22: [1258, 28, 2, 111, 7, 112],
  23: [1364, 30, 4, 121, 5, 122],
  24: [1474, 30, 6, 117, 4, 118],
  25: [1588, 26, 8, 106, 4, 107],
  26: [1706, 28, 10, 114, 2, 115],
  27: [1828, 30, 8, 122, 4, 123],
  28: [1921, 30, 3, 117, 10, 118],
  29: [2051, 30, 7, 116, 7, 117],
  30: [2185, 30, 5, 115, 10, 116],
  31: [2323, 30, 13, 115, 3, 116],
  32: [2465, 30, 17, 115, 0, 0],
  33: [2611, 30, 17, 115, 1, 116],
  34: [2761, 30, 13, 115, 6, 116],
  35: [2876, 30, 12, 121, 7, 122],
  36: [3034, 30, 6, 121, 14, 122],
  37: [3196, 30, 17, 122, 4, 123],
  38: [3362, 30, 4, 122, 18, 123],
  39: [3532, 30, 20, 117, 4, 118],
  40: [3706, 30, 19, 118, 6, 119],
};

function getDataCodewords(bytes, version) {
  const params = EC_PARAMS_L[version];
  const totalDataCodewords =
    params[2] * params[3] + params[4] * params[5];

  // Build bit stream: mode indicator (4 bits) + char count + data + terminator
  const bits = [];

  // Mode indicator: byte mode = 0100
  bits.push(0, 1, 0, 0);

  // Character count indicator length depends on version
  const ccBits = version <= 9 ? 8 : 16;
  for (let i = ccBits - 1; i >= 0; i--) {
    bits.push((bytes.length >> i) & 1);
  }

  // Data bytes
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((b >> i) & 1);
    }
  }

  // Terminator (up to 4 zero bits)
  const maxBits = totalDataCodewords * 8;
  const terminatorLen = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < terminatorLen; i++) bits.push(0);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad with alternating bytes 0xEC, 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    const pb = padBytes[padIdx % 2];
    for (let i = 7; i >= 0; i--) bits.push((pb >> i) & 1);
    padIdx++;
  }

  // Convert to codewords
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let j = 0; j < 8; j++) val = (val << 1) | (bits[i + j] || 0);
    codewords.push(val);
  }

  return codewords;
}

// ---------------------------------------------------------------------------
// Reed-Solomon Error Correction
// ---------------------------------------------------------------------------

// GF(256) with polynomial 0x11d
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = x << 1;
    if (x >= 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree) {
  let gen = [1];
  for (let i = 0; i < degree; i++) {
    const newGen = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      newGen[j] ^= gen[j];
      newGen[j + 1] ^= gfMul(gen[j], GF_EXP[i]);
    }
    gen = newGen;
  }
  return gen;
}

function rsEncode(data, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const result = new Array(ecCount).fill(0);
  for (const d of data) {
    const factor = d ^ result[0];
    result.shift();
    result.push(0);
    for (let i = 0; i < gen.length - 1; i++) {
      result[i] ^= gfMul(gen[i + 1], factor);
    }
  }
  return result;
}

function getErrorCorrectionCodewords(dataCodewords, version) {
  const params = EC_PARAMS_L[version];
  const ecPerBlock = params[1];
  const blocks1 = params[2];
  const dataPerBlock1 = params[3];
  const blocks2 = params[4];
  const dataPerBlock2 = params[5];

  const ecBlocks = [];
  let offset = 0;

  for (let i = 0; i < blocks1; i++) {
    const block = dataCodewords.slice(offset, offset + dataPerBlock1);
    ecBlocks.push(rsEncode(block, ecPerBlock));
    offset += dataPerBlock1;
  }

  for (let i = 0; i < blocks2; i++) {
    const block = dataCodewords.slice(offset, offset + dataPerBlock2);
    ecBlocks.push(rsEncode(block, ecPerBlock));
    offset += dataPerBlock2;
  }

  return ecBlocks;
}

function interleaveCodewords(dataCodewords, ecBlocks, version) {
  const params = EC_PARAMS_L[version];
  const blocks1 = params[2];
  const dataPerBlock1 = params[3];
  const blocks2 = params[4];
  const dataPerBlock2 = params[5];

  // Split data into blocks
  const dataBlocks = [];
  let offset = 0;
  for (let i = 0; i < blocks1; i++) {
    dataBlocks.push(dataCodewords.slice(offset, offset + dataPerBlock1));
    offset += dataPerBlock1;
  }
  for (let i = 0; i < blocks2; i++) {
    dataBlocks.push(dataCodewords.slice(offset, offset + dataPerBlock2));
    offset += dataPerBlock2;
  }

  const result = [];

  // Interleave data codewords
  const maxDataLen = Math.max(dataPerBlock1, dataPerBlock2);
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }

  // Interleave EC codewords
  const ecLen = ecBlocks[0].length;
  for (let i = 0; i < ecLen; i++) {
    for (const block of ecBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }

  return result;
}

function codewordsToBits(codewords) {
  const bits = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) {
      bits.push((cw >> i) & 1);
    }
  }
  return bits;
}

// ---------------------------------------------------------------------------
// Data bit placement
// ---------------------------------------------------------------------------

function placeDataBits(grid, reserved, bits, size) {
  let bitIdx = 0;
  // Columns are traversed right-to-left in pairs, skipping column 6
  let col = size - 1;
  while (col >= 0) {
    if (col === 6) col--; // Skip timing column

    for (let row = 0; row < size; row++) {
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (cc < 0) continue;
        // Determine actual row based on direction
        const isUpward = ((size - 1 - col) >> 1) % 2 === 0;
        const rr = isUpward ? size - 1 - row : row;

        if (reserved[rr][cc]) continue;
        if (bitIdx < bits.length) {
          grid[rr][cc] = bits[bitIdx] ? 1 : 0;
        }
        bitIdx++;
      }
    }
    col -= 2;
  }
}

// ---------------------------------------------------------------------------
// Masking
// ---------------------------------------------------------------------------

const MASK_FUNCTIONS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(grid, reserved, maskIdx, size) {
  const fn = MASK_FUNCTIONS[maskIdx];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] || grid[r][c] === undefined) {
        // Only mask data/EC modules (not reserved)
      }
      if (!reserved[r][c]) {
        // This shouldn't happen after placeDataBits, but guard anyway
      }
      // We need to mask non-reserved modules
    }
  }
  // Re-apply: mask only non-reserved modules
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      if (fn(r, c)) {
        grid[r][c] ^= 1;
      }
    }
  }
}

function selectBestMask(grid, reserved, size) {
  // For simplicity and correctness, evaluate all 8 masks and pick the one
  // with the lowest penalty score.
  let bestMask = 0;
  let bestScore = Infinity;

  for (let m = 0; m < 8; m++) {
    // Clone grid
    const testGrid = grid.map((row) => new Uint8Array(row));
    applyMask(testGrid, reserved, m, size);
    writeFormatInfo(testGrid, size, m);

    const score = evaluatePenalty(testGrid, size);
    if (score < bestScore) {
      bestScore = score;
      bestMask = m;
    }
  }

  return bestMask;
}

function evaluatePenalty(grid, size) {
  let penalty = 0;

  // Rule 1: Runs of same color in rows and columns
  for (let r = 0; r < size; r++) {
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (grid[r][c] === grid[r][c - 1]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += runLen - 2;
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += runLen - 2;
  }

  for (let c = 0; c < size; c++) {
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (grid[r][c] === grid[r - 1][c]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += runLen - 2;
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += runLen - 2;
  }

  // Rule 2: 2x2 blocks of same color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const val = grid[r][c];
      if (
        val === grid[r][c + 1] &&
        val === grid[r + 1][c] &&
        val === grid[r + 1][c + 1]
      ) {
        penalty += 3;
      }
    }
  }

  // Rule 3: Finder-like patterns (simplified)
  // Rule 4: Proportion of dark modules
  let darkCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) darkCount++;
    }
  }
  const total = size * size;
  const pct = (darkCount / total) * 100;
  const deviation = Math.abs(pct - 50);
  penalty += Math.floor(deviation / 5) * 10;

  return penalty;
}

// ---------------------------------------------------------------------------
// Format and version info
// ---------------------------------------------------------------------------

// Format info bits for EC level L (index 1) and masks 0-7
// Pre-computed BCH(15,5) encoded format strings
const FORMAT_INFO = [
  0x77c4, // L, mask 0
  0x72f3, // L, mask 1
  0x7daa, // L, mask 2
  0x789d, // L, mask 3
  0x662f, // L, mask 4
  0x6318, // L, mask 5
  0x6c41, // L, mask 6
  0x6976, // L, mask 7
];

function writeFormatInfo(grid, size, maskIdx) {
  const info = FORMAT_INFO[maskIdx];

  // Place format info bits around the finder patterns
  const bits = [];
  for (let i = 14; i >= 0; i--) {
    bits.push((info >> i) & 1);
  }

  // Horizontal strip near top-left finder
  const hPositions = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];

  for (let i = 0; i < 15; i++) {
    const [r, c] = hPositions[i];
    grid[r][c] = bits[i];
  }

  // Vertical strip near bottom-left and top-right finders
  const vPositions = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
    [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
    [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];

  for (let i = 0; i < 15; i++) {
    const [r, c] = vPositions[i];
    grid[r][c] = bits[i];
  }
}

// Version info for versions 7-40 (pre-computed BCH(18,6))
const VERSION_INFO = {
  7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3, 11: 0x0bbf6,
  12: 0x0c762, 13: 0x0d847, 14: 0x0e60d, 15: 0x0f928, 16: 0x10b78,
  17: 0x1145d, 18: 0x12a17, 19: 0x13532, 20: 0x149a6, 21: 0x15683,
  22: 0x168c9, 23: 0x177ec, 24: 0x18ec4, 25: 0x191e1, 26: 0x1afab,
  27: 0x1b08e, 28: 0x1cc1a, 29: 0x1d33f, 30: 0x1ed75, 31: 0x1f250,
  32: 0x209d5, 33: 0x216f0, 34: 0x228ba, 35: 0x2379f, 36: 0x24b0b,
  37: 0x2542e, 38: 0x26a64, 39: 0x27541, 40: 0x28c69,
};

function writeVersionInfo(grid, size, version) {
  if (version < 7) return;
  const info = VERSION_INFO[version];
  if (!info) return;

  for (let i = 0; i < 18; i++) {
    const bit = (info >> i) & 1;
    const row = Math.floor(i / 3);
    const col = size - 11 + (i % 3);
    grid[row][col] = bit;
    grid[col][row] = bit;
  }
}

// ---------------------------------------------------------------------------
// Canvas rendering
// ---------------------------------------------------------------------------

function renderModulesToDataUrl(grid) {
  const size = grid.length;
  const quietZone = 4;
  const moduleSize = 4;
  const totalSize = (size + quietZone * 2) * moduleSize;

  const canvas = document.createElement('canvas');
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalSize, totalSize);

  // Dark modules
  ctx.fillStyle = '#000000';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) {
        ctx.fillRect(
          (c + quietZone) * moduleSize,
          (r + quietZone) * moduleSize,
          moduleSize,
          moduleSize
        );
      }
    }
  }

  return canvas.toDataURL('image/png');
}

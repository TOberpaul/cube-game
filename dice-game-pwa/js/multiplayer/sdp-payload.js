/**
 * SDP-Payload Serializer — Offline P2P Multiplayer
 * Compact serialization for QR code transfer and deep-link sharing.
 * SDP string is passed through untouched to avoid WebRTC parsing issues.
 */

const VALID_TYPES = ['offer', 'answer'];

export function validateSdpPayload(payload) {
  if (payload == null || typeof payload !== 'object') {
    return { valid: false, error: 'payload must be a non-null object' };
  }
  if (typeof payload.type !== 'string' || !VALID_TYPES.includes(payload.type)) {
    return { valid: false, error: 'type must be "offer" or "answer"' };
  }
  if (typeof payload.sdp !== 'string' || payload.sdp.length === 0) {
    return { valid: false, error: 'sdp must be a non-empty string' };
  }
  if (!Array.isArray(payload.candidates)) {
    return { valid: false, error: 'candidates must be an array' };
  }
  return { valid: true };
}

export function serializeSdpPayload(payload) {
  const result = validateSdpPayload(payload);
  if (!result.valid) {
    throw new Error(`Invalid SDP payload: ${result.error}`);
  }
  return JSON.stringify({
    t: payload.type === 'offer' ? 0 : 1,
    s: payload.sdp,
    c: payload.candidates.map(c => c.candidate),
  });
}

export function deserializeSdpPayload(json) {
  if (typeof json !== 'string') {
    throw new Error('Input must be a string');
  }
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }
  if ('t' in parsed && 's' in parsed) {
    return {
      type: parsed.t === 0 ? 'offer' : 'answer',
      sdp: parsed.s,
      candidates: (parsed.c || []).map(c => ({
        candidate: c,
        sdpMid: '0',
        sdpMLineIndex: 0,
        usernameFragment: null,
      })),
    };
  }
  return parsed;
}

// --- Deep-link compression (deflate-raw + base64url) ---

export async function compressForUrl(jsonString) {
  const bytes = new TextEncoder().encode(jsonString);
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const compressed = await new Response(cs.readable).arrayBuffer();
  return uint8ToBase64Url(new Uint8Array(compressed));
}

export async function decompressFromUrl(base64url) {
  const bytes = base64UrlToUint8(base64url);
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const decompressed = await new Response(ds.readable).arrayBuffer();
  return new TextDecoder().decode(decompressed);
}

function uint8ToBase64Url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUint8(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * SDP-Payload Serializer — Offline P2P Multiplayer
 * Serialization, deserialization and validation of SDP payloads
 * used for manual WebRTC signaling (QR code / copy-paste).
 *
 * Includes SDP minification for smaller QR codes.
 *
 * @module sdp-payload
 * Feature: offline-multiplayer, Anforderungen: 3.1, 3.2, 3.5, 3.6, 9.1, 9.2, 9.3, 9.4
 */

const VALID_TYPES = ['offer', 'answer'];

/**
 * Validates an SDP-Payload object.
 * @param {object} payload
 * @returns {{ valid: boolean, error?: string }}
 */
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

// ---- SDP Minification ----

/** SDP lines safe to strip without breaking the WebRTC connection */
const STRIP_PREFIXES = [
  'a=msid-semantic', 'a=group:', 'a=extmap:', 'a=rtcp-mux',
  'a=rtcp-rsize', 'a=sctpmap:', 'a=max-message-size', 'b=',
  'a=ssrc:', 'a=rtpmap:', 'a=fmtp:', 'a=rtcp-fb:', 'a=rtcp:',
];

function minifySdp(sdp) {
  return sdp
    .split(/\r?\n/)
    .filter(line => line && !STRIP_PREFIXES.some(p => line.startsWith(p)))
    .join('\n');
}

function restoreSdp(minified) {
  // WebRTC needs \r\n and a trailing newline
  let sdp = minified.replace(/\n/g, '\r\n');
  if (!sdp.endsWith('\r\n')) sdp += '\r\n';
  return sdp;
}

// ---- Compact candidate encoding ----

function minifyCandidates(candidates) {
  // Only keep the candidate string — sdpMid and sdpMLineIndex can be derived
  return candidates.map(c => c.candidate);
}

function restoreCandidates(arr) {
  return arr.map(c => ({
    candidate: c,
    sdpMid: '0',
    sdpMLineIndex: 0,
    usernameFragment: null,
  }));
}

// ---- Public API ----

/**
 * Serializes an SDP-Payload to a compact JSON string.
 * Uses short keys and SDP minification to reduce size for QR codes.
 *
 * @param {object} payload
 * @returns {string} Compact JSON string
 * @throws {Error} If the payload is invalid
 */
export function serializeSdpPayload(payload) {
  const result = validateSdpPayload(payload);
  if (!result.valid) {
    throw new Error(`Invalid SDP payload: ${result.error}`);
  }

  return JSON.stringify({
    t: payload.type === 'offer' ? 0 : 1,
    s: minifySdp(payload.sdp),
    c: minifyCandidates(payload.candidates),
  });
}

/**
 * Deserializes a compact JSON string back to an SDP-Payload object.
 *
 * @param {string} json
 * @returns {object} SDP-Payload object
 * @throws {Error} If the input is invalid
 */
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

  // Support both compact format (t/s/c) and full format (type/sdp/candidates)
  if ('t' in parsed && 's' in parsed) {
    return {
      type: parsed.t === 0 ? 'offer' : 'answer',
      sdp: restoreSdp(parsed.s),
      candidates: restoreCandidates(parsed.c || []),
    };
  }

  return parsed;
}

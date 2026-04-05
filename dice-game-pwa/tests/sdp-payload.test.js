import { describe, it, expect } from 'vitest';
import {
  serializeSdpPayload,
  deserializeSdpPayload,
  validateSdpPayload,
} from '../js/multiplayer/sdp-payload.js';

const validOffer = {
  type: 'offer',
  sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n',
  candidates: [
    { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 5000 typ host', sdpMid: '0', sdpMLineIndex: 0, usernameFragment: 'abc' },
  ],
};

const validAnswer = {
  type: 'answer',
  sdp: 'v=0\r\no=- 456 2 IN IP4 127.0.0.1\r\n',
  candidates: [],
};

describe('validateSdpPayload', () => {
  it('returns valid for a correct offer payload', () => {
    expect(validateSdpPayload(validOffer)).toEqual({ valid: true });
  });

  it('returns valid for a correct answer payload', () => {
    expect(validateSdpPayload(validAnswer)).toEqual({ valid: true });
  });

  it('returns error when payload is null', () => {
    const result = validateSdpPayload(null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('payload');
  });

  it('returns error when type is missing', () => {
    const result = validateSdpPayload({ sdp: 'x', candidates: [] });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('type');
  });

  it('returns error when type is invalid', () => {
    const result = validateSdpPayload({ type: 'invalid', sdp: 'x', candidates: [] });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('type');
  });

  it('returns error when sdp is empty string', () => {
    const result = validateSdpPayload({ type: 'offer', sdp: '', candidates: [] });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('sdp');
  });

  it('returns error when sdp is not a string', () => {
    const result = validateSdpPayload({ type: 'offer', sdp: 123, candidates: [] });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('sdp');
  });

  it('returns error when candidates is not an array', () => {
    const result = validateSdpPayload({ type: 'offer', sdp: 'x', candidates: 'not-array' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('candidates');
  });
});

describe('serializeSdpPayload', () => {
  it('serializes to compact JSON with short keys', () => {
    const json = serializeSdpPayload(validOffer);
    const parsed = JSON.parse(json);
    // Uses compact keys: t, s, c
    expect(parsed.t).toBe(0); // offer = 0
    expect(typeof parsed.s).toBe('string');
    expect(Array.isArray(parsed.c)).toBe(true);
  });

  it('strips extra fields from payload', () => {
    const payloadWithExtra = { ...validOffer, extra: 'should-be-stripped' };
    const json = serializeSdpPayload(payloadWithExtra);
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed).sort()).toEqual(['c', 's', 't']);
  });

  it('throws on invalid payload', () => {
    expect(() => serializeSdpPayload({ type: 'bad' })).toThrow('Invalid SDP payload');
  });

  it('answer type serializes as 1', () => {
    const json = serializeSdpPayload(validAnswer);
    const parsed = JSON.parse(json);
    expect(parsed.t).toBe(1);
  });
});

describe('deserializeSdpPayload', () => {
  it('round-trips through serialize/deserialize preserving type and candidates', () => {
    const json = serializeSdpPayload(validOffer);
    const result = deserializeSdpPayload(json);
    expect(result.type).toBe('offer');
    expect(result.candidates[0].candidate).toBe(validOffer.candidates[0].candidate);
    expect(result.sdp.length).toBeGreaterThan(0);
  });

  it('handles full-format JSON for backwards compatibility', () => {
    const json = JSON.stringify(validOffer);
    const result = deserializeSdpPayload(json);
    expect(result.type).toBe('offer');
    expect(result.sdp).toBe(validOffer.sdp);
  });

  it('throws on invalid JSON', () => {
    expect(() => deserializeSdpPayload('not-json')).toThrow('Invalid JSON');
  });

  it('throws when input is not a string', () => {
    expect(() => deserializeSdpPayload(123)).toThrow('Input must be a string');
  });
});

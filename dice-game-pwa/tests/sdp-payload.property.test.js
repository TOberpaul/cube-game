// Feature: offline-multiplayer — SDP-Payload Property Tests
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  serializeSdpPayload,
  deserializeSdpPayload,
  validateSdpPayload,
} from '../js/multiplayer/sdp-payload.js';

// --- Generators ---

const iceCandidateArb = fc.record({
  candidate: fc.string({ minLength: 1 }),
  sdpMid: fc.string({ minLength: 0 }),
  sdpMLineIndex: fc.nat({ max: 10 }),
  usernameFragment: fc.string({ minLength: 0 }),
});

const sdpPayloadArb = fc.record({
  type: fc.constantFrom('offer', 'answer'),
  sdp: fc.string({ minLength: 1 }),
  candidates: fc.array(iceCandidateArb, { minLength: 0, maxLength: 10 }),
});

// --- Property 1: Round-Trip ---

describe('Property 1: SDP-Payload Round-Trip', () => {
  it('deserialize(serialize(payload)) preserves type and candidate strings', () => {
    fc.assert(
      fc.property(sdpPayloadArb, (payload) => {
        const serialized = serializeSdpPayload(payload);
        const deserialized = deserializeSdpPayload(serialized);

        expect(deserialized.type).toBe(payload.type);
        // Candidate strings are preserved
        expect(deserialized.candidates.map(c => c.candidate))
          .toEqual(payload.candidates.map(c => c.candidate));
        // SDP is non-empty
        expect(deserialized.sdp.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 2: Structural Invariant ---

describe('Property 2: SDP-Payload Strukturelle Invariante', () => {
  it('serialized payload is valid JSON with keys {t, s, c}', () => {
    fc.assert(
      fc.property(sdpPayloadArb, (payload) => {
        const serialized = serializeSdpPayload(payload);
        const parsed = JSON.parse(serialized);

        expect(Object.keys(parsed).sort()).toEqual(['c', 's', 't']);
        expect([0, 1]).toContain(parsed.t);
        expect(typeof parsed.s).toBe('string');
        expect(Array.isArray(parsed.c)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 3: Validation — Invalid Payloads ---

const validBaseArb = fc.record({
  type: fc.constantFrom('offer', 'answer'),
  sdp: fc.string({ minLength: 1 }),
  candidates: fc.array(fc.record({
    candidate: fc.string({ minLength: 1 }),
    sdpMid: fc.string({ minLength: 0 }),
    sdpMLineIndex: fc.nat({ max: 10 }),
    usernameFragment: fc.string({ minLength: 0 }),
  }), { minLength: 0, maxLength: 5 }),
});

const invalidPayloadArb = fc.oneof(
  validBaseArb.map(p => { const { type, ...rest } = p; return { payload: rest, field: 'type' }; }),
  fc.tuple(validBaseArb, fc.string({ minLength: 1 }).filter(s => s !== 'offer' && s !== 'answer'))
    .map(([p, bad]) => ({ payload: { ...p, type: bad }, field: 'type' })),
  validBaseArb.map(p => { const { sdp, ...rest } = p; return { payload: rest, field: 'sdp' }; }),
  validBaseArb.map(p => ({ payload: { ...p, sdp: '' }, field: 'sdp' })),
  fc.tuple(validBaseArb, fc.oneof(fc.integer(), fc.boolean(), fc.constant(null)))
    .map(([p, bad]) => ({ payload: { ...p, sdp: bad }, field: 'sdp' })),
  validBaseArb.map(p => { const { candidates, ...rest } = p; return { payload: rest, field: 'candidates' }; }),
  fc.tuple(validBaseArb, fc.oneof(fc.string(), fc.integer(), fc.constant(null)))
    .map(([p, bad]) => ({ payload: { ...p, candidates: bad }, field: 'candidates' })),
);

describe('Property 3: SDP-Payload Validierung — Ungültige Payloads', () => {
  it('validateSdpPayload returns { valid: false, error } naming the problematic field', () => {
    fc.assert(
      fc.property(invalidPayloadArb, ({ payload, field }) => {
        const result = validateSdpPayload(payload);
        expect(result.valid).toBe(false);
        expect(typeof result.error).toBe('string');
        expect(result.error.toLowerCase()).toContain(field);
      }),
      { numRuns: 100 }
    );
  });
});

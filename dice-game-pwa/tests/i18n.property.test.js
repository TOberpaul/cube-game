// Feature: dice-game-pwa, Property 10: i18n-Schlüssel-Auflösung mit Platzhaltern
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { t, loadMessages } from '../js/i18n.js';
import deMessages from '../locales/de.json';

/**
 * **Validates: Requirements 9.6**
 *
 * Property 10: For every defined key and arbitrary placeholder values,
 * t(key, params) returns a non-empty string without unresolved placeholders.
 */

/** Extract placeholder names from a template string, e.g. "{name}" → ["name"] */
function extractPlaceholders(template) {
  const matches = template.match(/\{(\w+)\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1, -1)))];
}

describe('Property 10: i18n-Schlüssel-Auflösung mit Platzhaltern', () => {
  beforeEach(() => {
    loadMessages(deMessages, 'de');
  });

  it('t(key, params) returns a non-empty string without unresolved placeholders for every defined key', () => {
    const keys = Object.keys(deMessages);
    const placeholdersByKey = {};
    for (const key of keys) {
      placeholdersByKey[key] = extractPlaceholders(deMessages[key]);
    }

    // Arbitrary for generating a params object given a list of placeholder names
    const paramsArb = (placeholders) => {
      if (placeholders.length === 0) {
        return fc.constant({});
      }
      return fc
        .tuple(
          ...placeholders.map(() =>
            fc.oneof(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.integer({ min: 0, max: 9999 }).map(String)
            )
          )
        )
        .map((values) => {
          const params = {};
          placeholders.forEach((name, i) => {
            params[name] = values[i];
          });
          return params;
        });
    };

    // Generate a random key from the defined keys and matching params
    const keyAndParamsArb = fc
      .integer({ min: 0, max: keys.length - 1 })
      .chain((idx) => {
        const key = keys[idx];
        const placeholders = placeholdersByKey[key];
        return paramsArb(placeholders).map((params) => ({ key, params }));
      });

    fc.assert(
      fc.property(keyAndParamsArb, ({ key, params }) => {
        const result = t(key, params);

        // Must be a non-empty string
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);

        // Must not contain unresolved placeholder markers
        expect(result).not.toMatch(/\{\w+\}/);
      }),
      { numRuns: 100 }
    );
  });
});

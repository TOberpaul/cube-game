/**
 * i18n System — Zentrales Lokalisierungssystem.
 * Validates: Requirements 9.6
 */

let messages = {};
let currentLocale = 'de';

export async function setLocale(locale) {
  const url = new URL(`../locales/${locale}.json`, import.meta.url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load locale "${locale}": ${response.status}`);
  }
  messages = await response.json();
  currentLocale = locale;
}

export function t(key, params) {
  let value = messages[key];
  if (value === undefined || value === null) {
    return key;
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return value;
}

export function getLocale() {
  return currentLocale;
}

export function loadMessages(msgs, locale = 'de') {
  messages = { ...msgs };
  currentLocale = locale;
}

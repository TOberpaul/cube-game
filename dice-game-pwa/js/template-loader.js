/**
 * Template Loader — Loads HTML templates, replaces i18n placeholders, returns DocumentFragment.
 * Feature: dice-game-pwa
 */

/**
 * Loads an HTML template, replaces i18n placeholders, and returns a DocumentFragment.
 * @param {string} path - Path to the HTML template file
 * @param {Function} t - i18n translation function
 * @returns {Promise<DocumentFragment>}
 */
export async function loadTemplate(path, t) {
  const response = await fetch(path);
  let html = await response.text();

  // Replace {{key}} placeholders with i18n translations
  html = html.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const translated = t(key.trim());
    return translated !== key.trim() ? translated : match;
  });

  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content;
}

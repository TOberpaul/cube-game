import { useState, useEffect } from 'react';
import { loadMessages, t as translate } from '@pwa/i18n';

/**
 * Hook to initialize the i18n system and provide the `t()` function.
 * Loads the German locale from /locales/de.json (public directory)
 * instead of relying on setLocale() which uses import.meta.url relative paths.
 */
export function useI18n() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}locales/de.json`)
      .then((res) => res.json())
      .then((messages) => {
        if (!cancelled) {
          loadMessages(messages, 'de');
          setReady(true);
        }
      })
      .catch(() => {
        // Fallback: t() returns the key itself when no messages are loaded (Req 10.3)
        if (!cancelled) setReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  return { t: translate, ready };
}

// Re-export t for direct use in components that render after init
export { t } from '@pwa/i18n';

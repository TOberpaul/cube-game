import { useState, useEffect, useCallback } from 'react';

export type Route = 'home' | 'game' | 'result' | 'lobby';
export type RouteParams = Record<string, string>;

export interface RouterState {
  route: Route;
  params: RouteParams;
}

const VALID_ROUTES: ReadonlySet<string> = new Set<Route>(['home', 'game', 'result', 'lobby']);

/**
 * Parse a hash string like `#route?key=value&key2=value2` into a RouterState.
 * Returns `{ route, params }`. Falls back to `home` for empty or invalid routes.
 */
export function parseHash(hash: string): RouterState {
  // Strip leading '#'
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;

  if (!raw) {
    return { route: 'home', params: {} };
  }

  const [routePart, queryPart] = raw.split('?', 2) as [string, string | undefined];
  const params: RouteParams = {};

  if (queryPart) {
    const searchParams = new URLSearchParams(queryPart);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  }

  // Validate route — fall back to home for unknown routes
  const route: Route = VALID_ROUTES.has(routePart) ? (routePart as Route) : 'home';

  return { route, params };
}

/**
 * Build a hash string from a route and optional params.
 * Returns e.g. `#game?modeId=kniffel&playType=solo`.
 */
export function buildHash(route: Route, params?: RouteParams): string {
  const entries = params ? Object.entries(params).filter(([, v]) => v !== undefined && v !== '') : [];

  if (entries.length === 0) {
    return `#${route}`;
  }

  const query = new URLSearchParams(entries).toString();
  return `#${route}?${query}`;
}

/**
 * Minimal hash-based router hook.
 *
 * - Listens to `hashchange` events
 * - Parses `#route?key=value` format
 * - Default route: `#home` when hash is empty
 *
 * Validates: Requirements 3.1, 3.2, 3.5, 3.6, 3.7
 */
export function useHashRouter(): {
  route: Route;
  params: RouteParams;
  navigate: (route: Route, params?: RouteParams) => void;
} {
  const [state, setState] = useState<RouterState>(() => {
    const initial = parseHash(window.location.hash);
    const canonicalHash = buildHash(initial.route, initial.params);
    if (window.location.hash !== canonicalHash) {
      window.location.replace(canonicalHash);
    }
    return initial;
  });

  const navigate = useCallback((route: Route, params?: RouteParams) => {
    const hash = buildHash(route, params);
    window.location.hash = hash;
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseHash(window.location.hash);
      const canonical = buildHash(parsed.route, parsed.params);
      if (window.location.hash !== canonical) {
        window.location.replace(canonical);
      }
      setState(parsed);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return { route: state.route, params: state.params, navigate };
}

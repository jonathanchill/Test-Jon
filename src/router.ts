// Hash routing: #/unit/subjunctive, #/unit/subjunctive/drill/gapfill,
// #/review, #/bank, #/errors, #/settings. Refreshing a deep link on GitHub
// Pages then always hits index.html, so nothing 404s.
import { useSyncExternalStore } from 'react';
import { MODES, type Mode } from './engine/session';

export type Route =
  | { name: 'home' }
  | { name: 'unit'; id: string }
  | { name: 'drill'; id: string; mode: Mode }
  | { name: 'review' }
  | { name: 'bank' }
  | { name: 'errors' }
  | { name: 'settings' }
  | { name: 'not-found'; path: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  if (path === '') return { name: 'home' };
  const parts = path.split('/').map(decodeURIComponent);
  if (parts.length === 1) {
    if (parts[0] === 'settings') return { name: 'settings' };
    if (parts[0] === 'review') return { name: 'review' };
    if (parts[0] === 'bank') return { name: 'bank' };
    if (parts[0] === 'errors') return { name: 'errors' };
  }
  if (parts[0] === 'unit' && parts[1]) {
    if (parts.length === 2) return { name: 'unit', id: parts[1] };
    if (parts[2] === 'drill') {
      const mode = (MODES as string[]).includes(parts[3] ?? '') ? (parts[3] as Mode) : 'mixed';
      return { name: 'drill', id: parts[1], mode };
    }
  }
  return { name: 'not-found', path };
}

export function href(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'unit':
      return `#/unit/${encodeURIComponent(route.id)}`;
    case 'drill':
      return `#/unit/${encodeURIComponent(route.id)}/drill/${route.mode}`;
    case 'review':
      return '#/review';
    case 'bank':
      return '#/bank';
    case 'errors':
      return '#/errors';
    case 'settings':
      return '#/settings';
    case 'not-found':
      return `#/${route.path}`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = href(route);
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

function getHash() {
  return window.location.hash;
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  return parseHash(hash);
}

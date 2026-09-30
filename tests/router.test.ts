import { describe, expect, it } from 'vitest';
import { href, parseHash } from '../src/router';

describe('hash router', () => {
  it('parses every route shape', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/')).toEqual({ name: 'home' });
    expect(parseHash('#/unit/subjunctive')).toEqual({ name: 'unit', id: 'subjunctive' });
    expect(parseHash('#/unit/subjunctive/drill/gapfill')).toEqual({ name: 'drill', id: 'subjunctive', mode: 'gapfill' });
    expect(parseHash('#/unit/subjunctive/drill/nope')).toEqual({ name: 'drill', id: 'subjunctive', mode: 'mixed' });
    expect(parseHash('#/settings')).toEqual({ name: 'settings' });
    expect(parseHash('#/what')).toEqual({ name: 'not-found', path: 'what' });
  });
  it('round-trips through href', () => {
    const routes = [parseHash('#/unit/past'), parseHash('#/unit/past/drill/flash-en'), parseHash('#/settings')];
    for (const r of routes) expect(parseHash(href(r))).toEqual(r);
  });
});

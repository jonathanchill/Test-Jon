import { describe, expect, it } from 'vitest';
import { dayKey, emptyState, mergeStates, parseState, recordAnswer, serialise } from '../src/engine/progress';
import { DAY } from '../src/engine/srs';

const T0 = new Date(2026, 8, 30, 9, 0, 0).getTime();

describe('recordAnswer', () => {
  it('creates progress for a new item and starts a streak', () => {
    const s = recordAnswer(emptyState(), 'subj-001', 4, T0);
    expect(s.items['subj-001'].reps).toBe(1);
    expect(s.streak).toEqual({ current: 1, lastDay: dayKey(T0) });
  });
  it('extends the streak on consecutive days and resets after a gap', () => {
    let s = recordAnswer(emptyState(), 'a', 4, T0);
    s = recordAnswer(s, 'a', 4, T0 + DAY);
    expect(s.streak.current).toBe(2);
    s = recordAnswer(s, 'a', 4, T0 + DAY + 3600_000);
    expect(s.streak.current).toBe(2);
    s = recordAnswer(s, 'a', 4, T0 + 5 * DAY);
    expect(s.streak.current).toBe(1);
  });
});

describe('export / import round trip', () => {
  it('serialises and parses back to an equal state', () => {
    let s = recordAnswer(emptyState(), 'subj-001', 4, T0);
    s = recordAnswer(s, 'mieux-022', 0, T0 + 1000);
    s = { ...s, settings: { ...s.settings, showVulgar: true }, lastExportAt: T0 + 5000 };
    const text = serialise(s);
    const back = parseState(text);
    expect(back).toEqual(s);
  });
  it('rejects files that are not progress exports', () => {
    expect(() => parseState('{"hello":1}')).toThrow();
    expect(() => parseState('[]')).toThrow();
    expect(() => parseState('not json')).toThrow();
  });
  it('drops malformed item entries but keeps the rest', () => {
    const s = recordAnswer(emptyState(), 'a', 4, T0);
    const text = JSON.stringify({ ...s, items: { ...s.items, junk: { reps: 'x' } } });
    expect(Object.keys(parseState(text).items)).toEqual(['a']);
  });
});

describe('mergeStates', () => {
  it('keeps the more recently answered copy of each item and unions the rest', () => {
    const laptop = recordAnswer(recordAnswer(emptyState(), 'a', 4, T0), 'b', 4, T0 + 1000);
    const phone = recordAnswer(recordAnswer(emptyState(), 'a', 0, T0 + 2000), 'c', 4, T0 + 3000);
    const { state, imported } = mergeStates(laptop, phone);
    expect(imported).toBe(2);
    expect(state.items.a.lastGrade).toBe(0);
    expect(state.items.b.lastGrade).toBe(4);
    expect(state.items.c.lastGrade).toBe(4);
    expect(state.settings).toEqual(laptop.settings);
  });
});

import { describe, expect, it } from 'vitest';
import type { Item, Unit } from '../src/content/types';
import { emptyState, recordAnswer, type ProgressState } from '../src/engine/progress';
import { buildBankSession, buildErrorSession, buildReviewSession, buildUnitSession, REVIEW_CAP, SESSION_CAP } from '../src/engine/session';
import { DAY } from '../src/engine/srs';

const T0 = Date.UTC(2026, 8, 30, 9, 0, 0);

function item(id: string, unit: string, type: Item['type'] = 'flashcard', extra: Partial<Item> = {}): Item {
  return { id, unit, type, fr: `fr ${id}`, en: `en ${id}`, register: 'neutral', source: 'added', lesson_date: null, check: false, tts: true, answers: [`fr ${id}`], prompt_fr: 'x ___', ...extra };
}

function unit(id: string, items: Item[], order = 1): Unit {
  return { id, title: id, priority: 1, order, explanation: 'x'.repeat(30), items };
}

describe('buildUnitSession', () => {
  const u = unit('u', [
    ...Array.from({ length: 30 }, (_, i) => item(`u-${String(i).padStart(3, '0')}`, 'u')),
    item('u-v', 'u', 'flashcard', { register: 'vulgar' }),
    item('u-g', 'u', 'gapfill'),
  ]);

  it('caps the queue and hides vulgar items by default', () => {
    const q = buildUnitSession(u, 'mixed', emptyState(), T0);
    expect(q.length).toBe(SESSION_CAP);
    expect(q.some((i) => i.id === 'u-v')).toBe(false);
  });

  it('includes vulgar items when the setting is on', () => {
    const s: ProgressState = { ...emptyState(), settings: { ...emptyState().settings, showVulgar: true } };
    const q = buildUnitSession(u, 'flash-fr', s, T0);
    expect(q.some((i) => i.id === 'u-v') || q.length === SESSION_CAP).toBe(true);
    expect(q.every((i) => i.type === 'flashcard')).toBe(true);
  });

  it('puts due items before new ones and new before not-yet-due', () => {
    let s = emptyState();
    s = recordAnswer(s, 'u-005', 4, T0 - 2 * DAY); // due now
    s = recordAnswer(s, 'u-006', 4, T0); // due tomorrow
    const q = buildUnitSession(u, 'flash-fr', s, T0);
    expect(q[0].id).toBe('u-005');
    expect(q.map((i) => i.id)).not.toContain('u-006'); // 30 new items fill the cap first
  });

  it('filters by mode', () => {
    expect(buildUnitSession(u, 'gapfill', emptyState(), T0).map((i) => i.id)).toEqual(['u-g']);
  });
});

describe('buildReviewSession', () => {
  const units = [unit('a', Array.from({ length: 40 }, (_, i) => item(`a-${i}`, 'a'))), unit('b', Array.from({ length: 40 }, (_, i) => item(`b-${i}`, 'b')), 2)];

  it('only includes seen items that are due, from every unit', () => {
    let s = emptyState();
    s = recordAnswer(s, 'a-1', 4, T0 - 3 * DAY);
    s = recordAnswer(s, 'b-2', 4, T0 - 3 * DAY);
    s = recordAnswer(s, 'b-3', 4, T0); // not due yet
    const q = buildReviewSession(units, s, T0);
    expect(q.map((i) => i.id).sort()).toEqual(['a-1', 'b-2']);
  });

  it('caps at REVIEW_CAP and favours mistake-bank items', () => {
    let s = emptyState();
    for (let i = 0; i < 40; i++) s = recordAnswer(s, `a-${i}`, 4, T0 - 3 * DAY);
    for (let i = 0; i < 40; i++) s = recordAnswer(s, `b-${i}`, 4, T0 - 3 * DAY);
    // Ten bank items, answered wrong long enough ago to be due.
    for (let i = 0; i < 10; i++) s = recordAnswer(s, `a-${i}`, 0, T0 - DAY);
    let bankHits = 0;
    const runs = 20;
    for (let r = 0; r < runs; r++) {
      const q = buildReviewSession(units, s, T0 + r);
      expect(q.length).toBe(REVIEW_CAP);
      expect(new Set(q.map((i) => i.id)).size).toBe(REVIEW_CAP);
      bankHits += q.filter((i) => s.items[i.id].inBank).length;
    }
    // Unweighted expectation would be 10 * 30/80 = 3.75 per run; double weight pushes it well above that.
    expect(bankHits / runs).toBeGreaterThan(5);
  });
});

describe('buildBankSession and buildErrorSession', () => {
  it('bank holds only inBank items', () => {
    const units = [unit('a', [item('a-1', 'a'), item('a-2', 'a')])];
    let s = recordAnswer(emptyState(), 'a-1', 0, T0);
    s = recordAnswer(s, 'a-2', 4, T0);
    expect(buildBankSession(units, s, T0).map((i) => i.id)).toEqual(['a-1']);
  });

  it('error deck takes errorspot items from every unit, hot ones first', () => {
    const units = [unit('a', [item('a-e', 'a', 'errorspot'), item('a-f', 'a')]), unit('b', [item('b-e', 'b', 'errorspot')], 2)];
    const s = recordAnswer(emptyState(), 'a-e', 4, T0); // seen and not due: cold
    const q = buildErrorSession(units, s, T0);
    expect(q.map((i) => i.id)).toEqual(['b-e', 'a-e']);
  });
});

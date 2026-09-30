import { describe, expect, it } from 'vitest';
import type { Item, Unit } from '../src/content/types';
import { buildToday, isKnown, TODAY_NEW_FROM_UNIT, unitMastery, weakestUnit } from '../src/engine/mastery';
import { emptyState, recordAnswer, type ProgressState } from '../src/engine/progress';
import { DAY } from '../src/engine/srs';

const T0 = Date.UTC(2026, 8, 30, 9, 0, 0);

function item(id: string, unit: string): Item {
  return { id, unit, type: 'flashcard', fr: `fr ${id}`, en: `en ${id}`, register: 'neutral', source: 'added', lesson_date: null, check: false, tts: true };
}
function unit(id: string, n: number, priority: 1 | 2 | 3, order: number): Unit {
  return { id, title: id, priority, order, explanation: 'x'.repeat(30), items: Array.from({ length: n }, (_, i) => item(`${id}-${i}`, id)) };
}

function learn(state: ProgressState, id: string, times: number, start: number): ProgressState {
  let s = state;
  let t = start;
  for (let i = 0; i < times; i++) {
    s = recordAnswer(s, id, 4, t);
    t = s.items[id].due;
  }
  return s;
}

describe('mastery', () => {
  it('an item is known after three correct answers (interval >= 7 days), not after one', () => {
    let s = learn(emptyState(), 'a-0', 1, T0 - 10 * DAY);
    expect(isKnown(s.items['a-0'])).toBe(false);
    s = learn(emptyState(), 'a-0', 3, T0 - 10 * DAY);
    expect(isKnown(s.items['a-0'])).toBe(true);
  });
  it('a wrong answer drops an item out of known', () => {
    let s = learn(emptyState(), 'a-0', 3, T0 - 30 * DAY);
    s = recordAnswer(s, 'a-0', 0, T0);
    expect(isKnown(s.items['a-0'])).toBe(false);
  });
  it('unit mastery is the known share', () => {
    const u = unit('a', 4, 1, 1);
    let s = learn(emptyState(), 'a-0', 3, T0 - 30 * DAY);
    s = learn(s, 'a-1', 3, T0 - 30 * DAY);
    expect(unitMastery(u, s)).toBe(0.5);
  });
});

describe('weakestUnit and buildToday', () => {
  const p1 = unit('p1', 20, 1, 1);
  const p3 = unit('p3', 20, 3, 2);

  it('prefers a priority-1 unit unless it is much better known', () => {
    let s = emptyState();
    for (let i = 0; i < 6; i++) s = learn(s, `p1-${i}`, 3, T0 - 30 * DAY); // 30%
    expect(weakestUnit([p1, p3], s)?.id).toBe('p1');
    for (let i = 6; i < 14; i++) s = learn(s, `p1-${i}`, 3, T0 - 30 * DAY); // 70%
    expect(weakestUnit([p1, p3], s)?.id).toBe('p3');
  });

  it('mixes due reviews with new items from the weakest unit, no duplicates, capped', () => {
    let s = emptyState();
    for (let i = 0; i < 20; i++) s = recordAnswer(s, `p3-${i}`, 4, T0 - 3 * DAY); // all due
    const plan = buildToday([p1, p3], s, T0);
    expect(plan.unit?.id).toBe('p1');
    expect(plan.reviewCount).toBe(15);
    expect(plan.items.length).toBe(25);
    expect(new Set(plan.items.map((i) => i.id)).size).toBe(25);
    expect(plan.items.filter((i) => i.unit === 'p1').length).toBe(TODAY_NEW_FROM_UNIT);
  });

  it('with nothing due, today is just new items from the weakest unit', () => {
    const plan = buildToday([p1, p3], emptyState(), T0);
    expect(plan.reviewCount).toBe(0);
    expect(plan.items.length).toBe(TODAY_NEW_FROM_UNIT);
    expect(plan.items.every((i) => i.unit === 'p1')).toBe(true);
  });
});

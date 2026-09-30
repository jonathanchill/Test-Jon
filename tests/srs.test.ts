import { describe, expect, it } from 'vitest';
import { DAY, isDue, isNew, newProgress, review } from '../src/engine/srs';

const T0 = Date.UTC(2026, 8, 30, 9, 0, 0);

describe('SM-2 scheduling', () => {
  it('a new item is due immediately', () => {
    const p = newProgress(T0);
    expect(isNew(p)).toBe(true);
    expect(isDue(p, T0)).toBe(true);
  });

  it('first correct answer schedules one day, second six days, then grows by ease', () => {
    let p = review(newProgress(T0), 4, T0);
    expect(p.intervalDays).toBe(1);
    expect(p.due).toBe(T0 + DAY);
    expect(isDue(p, T0 + DAY - 1)).toBe(false);
    expect(isDue(p, T0 + DAY)).toBe(true);
    p = review(p, 4, T0 + DAY);
    expect(p.intervalDays).toBe(6);
    p = review(p, 4, T0 + 7 * DAY);
    expect(p.intervalDays).toBe(15); // 6 * 2.5
    expect(p.reps).toBe(3);
    expect(p.streak).toBe(3);
  });

  it('a wrong answer resets the interval, lowers ease and puts the item in the bank', () => {
    let p = review(newProgress(T0), 4, T0);
    p = review(p, 4, T0 + DAY);
    p = review(p, 0, T0 + 7 * DAY);
    expect(p.reps).toBe(0);
    expect(p.lapses).toBe(1);
    expect(p.streak).toBe(0);
    expect(p.ease).toBe(2.3);
    expect(p.inBank).toBe(true);
    expect(p.due - (T0 + 7 * DAY)).toBe(10 * 60 * 1000);
  });

  it('leaves the mistake bank after two consecutive correct answers', () => {
    let p = review(newProgress(T0), 0, T0);
    p = review(p, 4, T0 + DAY);
    expect(p.inBank).toBe(true);
    p = review(p, 4, T0 + 2 * DAY);
    expect(p.inBank).toBe(false);
  });

  it('a nearly-right answer keeps the item scheduled but does not count towards leaving the bank', () => {
    let p = review(newProgress(T0), 0, T0);
    p = review(p, 3, T0 + DAY);
    p = review(p, 3, T0 + 2 * DAY);
    expect(p.inBank).toBe(true);
    expect(p.reps).toBe(2);
    expect(p.intervalDays).toBe(2);
  });

  it('ease never drops below 1.3', () => {
    let p = newProgress(T0);
    for (let i = 0; i < 10; i++) p = review(p, 0, T0 + i * DAY);
    expect(p.ease).toBe(1.3);
  });

  it('easy grows the interval faster than good', () => {
    const good = review(review(newProgress(T0), 4, T0), 4, T0 + DAY);
    const easy = review(review(newProgress(T0), 5, T0), 5, T0 + DAY);
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
  });
});

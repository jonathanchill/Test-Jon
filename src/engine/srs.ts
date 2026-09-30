// Spaced repetition: a simplified SM-2. Pure functions over an explicit
// `now` (ms since epoch) so scheduling is deterministic and testable.

/** 0 = wrong, 3 = nearly / hard, 4 = correct, 5 = easy. */
export type Grade = 0 | 3 | 4 | 5;

export interface ItemProgress {
  /** Successful reviews since the last lapse. */
  reps: number;
  /** Times answered wrong, ever. */
  lapses: number;
  /** Consecutive fully correct answers (grade >= 4). */
  streak: number;
  /** SM-2 ease factor, never below 1.3. */
  ease: number;
  intervalDays: number;
  /** When the item is next due, ms since epoch. */
  due: number;
  /** When it was last answered, ms since epoch (0 = never). */
  last: number;
  lastGrade: Grade | null;
  /** In the mistake bank until answered correctly twice in a row. */
  inBank: boolean;
}

export const DAY = 24 * 60 * 60 * 1000;
const RETRY_DELAY = 10 * 60 * 1000;
const MIN_EASE = 1.3;

export function newProgress(now: number): ItemProgress {
  return { reps: 0, lapses: 0, streak: 0, ease: 2.5, intervalDays: 0, due: now, last: 0, lastGrade: null, inBank: false };
}

export function gradeFromResult(result: 'correct' | 'nearly' | 'wrong'): Grade {
  return result === 'correct' ? 4 : result === 'nearly' ? 3 : 0;
}

export function review(p: ItemProgress, grade: Grade, now: number): ItemProgress {
  if (grade < 3) {
    return {
      ...p,
      reps: 0,
      lapses: p.lapses + 1,
      streak: 0,
      ease: Math.max(MIN_EASE, round2(p.ease - 0.2)),
      intervalDays: 0,
      due: now + RETRY_DELAY,
      last: now,
      lastGrade: grade,
      inBank: true,
    };
  }

  const reps = p.reps + 1;
  let intervalDays: number;
  if (reps === 1) intervalDays = 1;
  else if (reps === 2) intervalDays = grade >= 4 ? 6 : 2;
  else intervalDays = Math.max(1, Math.round(p.intervalDays * p.ease * (grade === 3 ? 0.6 : 1)));
  if (grade === 5) intervalDays = Math.round(intervalDays * 1.3);

  const q = 5 - grade;
  const ease = Math.max(MIN_EASE, round2(p.ease + (0.1 - q * (0.08 + q * 0.02))));
  const streak = grade >= 4 ? p.streak + 1 : p.streak;
  const inBank = p.inBank && streak < 2;

  return { ...p, reps, streak, ease, intervalDays, due: now + intervalDays * DAY, last: now, lastGrade: grade, inBank };
}

export function isDue(p: ItemProgress | undefined, now: number): boolean {
  return p !== undefined && p.due <= now;
}

export function isNew(p: ItemProgress | undefined): boolean {
  return p === undefined || p.last === 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

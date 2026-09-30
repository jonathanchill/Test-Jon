import type { Item, ItemType, Unit } from '../content/types';
import type { ProgressState } from './progress';
import { isDue, isNew } from './srs';

export type Mode = 'flash-fr' | 'flash-en' | 'gapfill' | 'mixed';

export const MODE_LABELS: Record<Mode, string> = {
  'flash-fr': 'Flashcards, French to English',
  'flash-en': 'Flashcards, English to French',
  gapfill: 'Gap-fill',
  mixed: 'Everything, mixed',
};

export const SESSION_CAP = 25;

const TYPES_FOR_MODE: Record<Mode, ItemType[] | null> = {
  'flash-fr': ['flashcard'],
  'flash-en': ['flashcard'],
  gapfill: ['gapfill'],
  mixed: null,
};

/** Types the app can currently render. Items of other types are skipped. */
export const SUPPORTED_TYPES: ItemType[] = ['flashcard', 'gapfill'];

export function visibleItems(items: Item[], showVulgar: boolean): Item[] {
  return items.filter((i) => showVulgar || i.register !== 'vulgar');
}

/** Deterministic shuffle so a session built at the same instant is stable. */
export function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Builds a drill queue for one unit: due items first, then never-seen items,
 * then everything else, each group shuffled, capped at SESSION_CAP.
 */
export function buildUnitSession(unit: Unit, mode: Mode, state: ProgressState, now: number): Item[] {
  const types = TYPES_FOR_MODE[mode];
  const pool = visibleItems(unit.items, state.settings.showVulgar).filter(
    (i) => SUPPORTED_TYPES.includes(i.type) && (types === null || types.includes(i.type)),
  );
  const due: Item[] = [];
  const fresh: Item[] = [];
  const rest: Item[] = [];
  for (const item of pool) {
    const p = state.items[item.id];
    if (isNew(p)) fresh.push(item);
    else if (isDue(p, now)) due.push(item);
    else rest.push(item);
  }
  return [...shuffle(due, now), ...shuffle(fresh, now + 1), ...shuffle(rest, now + 2)].slice(0, SESSION_CAP);
}

export interface UnitStats {
  total: number;
  seen: number;
  due: number;
  inBank: number;
}

export function unitStats(unit: Unit, state: ProgressState, now: number): UnitStats {
  const items = visibleItems(unit.items, state.settings.showVulgar);
  let seen = 0;
  let due = 0;
  let inBank = 0;
  for (const item of items) {
    const p = state.items[item.id];
    if (!isNew(p)) seen++;
    if (!isNew(p) && isDue(p, now)) due++;
    if (p?.inBank) inBank++;
  }
  return { total: items.length, seen, due, inBank };
}

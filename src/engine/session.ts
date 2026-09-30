import type { Item, ItemType, Unit } from '../content/types';
import type { ProgressState } from './progress';
import { isDue, isNew } from './srs';

export type Mode = 'flash-fr' | 'flash-en' | 'gapfill' | 'choice' | 'write' | 'mixed';

export const MODES: Mode[] = ['flash-fr', 'flash-en', 'gapfill', 'choice', 'write', 'mixed'];

export const MODE_LABELS: Record<Mode, string> = {
  'flash-fr': 'Flashcards, French to English',
  'flash-en': 'Flashcards, English to French',
  gapfill: 'Gap-fill',
  choice: 'Multiple choice',
  write: 'Write it: translate, rewrite, fix the mistake',
  mixed: 'Everything, mixed',
};

export const SESSION_CAP = 25;
export const REVIEW_CAP = 30;

const TYPES_FOR_MODE: Record<Mode, ItemType[] | null> = {
  'flash-fr': ['flashcard'],
  'flash-en': ['flashcard'],
  gapfill: ['gapfill'],
  choice: ['choice'],
  write: ['transform', 'errorspot', 'translate', 'open'],
  mixed: null,
};

/** Types the app can currently render. Dictation waits for audio. */
export const SUPPORTED_TYPES: ItemType[] = ['flashcard', 'gapfill', 'choice', 'transform', 'errorspot', 'translate', 'open'];

export function typesForMode(mode: Mode): ItemType[] {
  return TYPES_FOR_MODE[mode] ?? SUPPORTED_TYPES;
}

export function visibleItems(items: Item[], showVulgar: boolean): Item[] {
  return items.filter((i) => showVulgar || i.register !== 'vulgar');
}

/** Deterministic shuffle so a session built with the same seed is stable. */
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
  const types = typesForMode(mode);
  const pool = visibleItems(unit.items, state.settings.showVulgar).filter((i) => SUPPORTED_TYPES.includes(i.type) && types.includes(i.type));
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

/**
 * The daily review: every item that has been seen and is due, from all units.
 * Items in the mistake bank count twice when the pool is bigger than the cap,
 * so they are more likely to make it in; the order is then shuffled.
 */
export function buildReviewSession(units: Unit[], state: ProgressState, now: number): Item[] {
  const due: Item[] = [];
  for (const unit of units) {
    for (const item of visibleItems(unit.items, state.settings.showVulgar)) {
      if (!SUPPORTED_TYPES.includes(item.type)) continue;
      const p = state.items[item.id];
      if (!isNew(p) && isDue(p, now)) due.push(item);
    }
  }
  if (due.length <= REVIEW_CAP) return shuffle(due, now);
  // Weighted pick without replacement: bank items get two tickets.
  const tickets = due.flatMap((i) => (state.items[i.id]?.inBank ? [i, i] : [i]));
  const picked: Item[] = [];
  const seen = new Set<string>();
  for (const item of shuffle(tickets, now)) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    picked.push(item);
    if (picked.length === REVIEW_CAP) break;
  }
  return picked;
}

/** Everything currently in the mistake bank, whether due or not. */
export function buildBankSession(units: Unit[], state: ProgressState, now: number): Item[] {
  const bank: Item[] = [];
  for (const unit of units) {
    for (const item of visibleItems(unit.items, state.settings.showVulgar)) {
      if (SUPPORTED_TYPES.includes(item.type) && state.items[item.id]?.inBank) bank.push(item);
    }
  }
  return shuffle(bank, now).slice(0, REVIEW_CAP);
}

/** The error-spotting deck: every errorspot item across all units, due and bank first. */
export function buildErrorSession(units: Unit[], state: ProgressState, now: number): Item[] {
  const all = units.flatMap((u) => visibleItems(u.items, state.settings.showVulgar).filter((i) => i.type === 'errorspot'));
  const hot = all.filter((i) => {
    const p = state.items[i.id];
    return isNew(p) || isDue(p, now) || p?.inBank;
  });
  const cold = all.filter((i) => !hot.includes(i));
  return [...shuffle(hot, now), ...shuffle(cold, now + 1)].slice(0, REVIEW_CAP);
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

export function countByType(items: Item[]): Partial<Record<ItemType, number>> {
  const counts: Partial<Record<ItemType, number>> = {};
  for (const i of items) counts[i.type] = (counts[i.type] ?? 0) + 1;
  return counts;
}

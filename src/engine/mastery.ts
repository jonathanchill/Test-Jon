// Mastery and the "today's lesson" builder.
import type { Item, Unit } from '../content/types';
import type { ProgressState } from './progress';
import { buildReviewSession, itemFitsMode, shuffle, visibleItems } from './session';
import { isDue, isNew, type ItemProgress } from './srs';

/** An item counts as known once it has been right often enough to be scheduled a week or more out. */
export const KNOWN_INTERVAL_DAYS = 7;

export function isKnown(p: ItemProgress | undefined): boolean {
  return p !== undefined && p.last > 0 && p.intervalDays >= KNOWN_INTERVAL_DAYS && !p.inBank;
}

/** 0 to 1: the share of a unit's visible items that are known. */
export function unitMastery(unit: Unit, state: ProgressState): number {
  const items = visibleItems(unit.items, state.settings.showVulgar);
  if (items.length === 0) return 0;
  const known = items.filter((i) => isKnown(state.items[i.id])).length;
  return known / items.length;
}

export function percent(fraction: number): number {
  return Math.round(fraction * 100);
}

/**
 * The unit to work on today: the lowest mastery, with priority 1 units
 * weighted so a P1 unit at 30% beats a P3 unit at 20%.
 */
export function weakestUnit(units: Unit[], state: ProgressState): Unit | null {
  if (units.length === 0) return null;
  const score = (u: Unit) => unitMastery(u, state) + (u.priority - 1) * 0.15;
  return [...units].sort((a, b) => score(a) - score(b) || a.order - b.order)[0];
}

export const TODAY_CAP = 25;
export const TODAY_NEW_FROM_UNIT = 10;

export interface TodayPlan {
  unit: Unit | null;
  items: Item[];
  /** How many came from the review pool. */
  reviewCount: number;
}

/**
 * About fifteen minutes: due reviews from everywhere (bank-weighted), then
 * up to ten new or due items from the weakest unit, mixed together.
 */
export function buildToday(units: Unit[], state: ProgressState, now: number): TodayPlan {
  const review = buildReviewSession(units, state, now).slice(0, TODAY_CAP - TODAY_NEW_FROM_UNIT);
  const unit = weakestUnit(units, state);
  const taken = new Set(review.map((i) => i.id));
  const fromUnit: Item[] = [];
  if (unit) {
    const pool = visibleItems(unit.items, state.settings.showVulgar).filter((i) => itemFitsMode(i, 'mixed') && !taken.has(i.id));
    const fresh = pool.filter((i) => isNew(state.items[i.id]));
    const due = pool.filter((i) => !isNew(state.items[i.id]) && isDue(state.items[i.id], now));
    const weak = pool.filter((i) => !isNew(state.items[i.id]) && !isKnown(state.items[i.id]) && !isDue(state.items[i.id], now));
    for (const i of [...shuffle(fresh, now), ...shuffle(due, now + 1), ...shuffle(weak, now + 2)]) {
      if (fromUnit.length >= TODAY_NEW_FROM_UNIT) break;
      fromUnit.push(i);
    }
  }
  const items = shuffle([...review, ...fromUnit], now + 3).slice(0, TODAY_CAP);
  return { unit, items, reviewCount: review.length };
}

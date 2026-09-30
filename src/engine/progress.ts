// Progress store: one localStorage key holding every item's SRS state plus
// settings. Exposed to React through useSyncExternalStore, and to tests as
// pure functions that never touch the DOM.
import { useSyncExternalStore } from 'react';
import { type Grade, type ItemProgress, newProgress, review } from './srs';

export interface Settings {
  showVulgar: boolean;
  speed: 0.8 | 1 | 1.25;
  nativeSpeed: boolean;
  audioOnly: boolean;
}

export interface Streak {
  current: number;
  /** YYYY-MM-DD of the last day with at least one answer. */
  lastDay: string | null;
}

export interface ProgressState {
  version: 1;
  items: Record<string, ItemProgress>;
  settings: Settings;
  streak: Streak;
  updatedAt: number;
}

export const STORAGE_KEY = 'french-lessons.v1';

export const DEFAULT_SETTINGS: Settings = { showVulgar: false, speed: 1, nativeSpeed: false, audioOnly: false };

export function emptyState(): ProgressState {
  return { version: 1, items: {}, settings: { ...DEFAULT_SETTINGS }, streak: { current: 0, lastDay: null }, updatedAt: 0 };
}

export function dayKey(now: number): string {
  const d = new Date(now);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function bumpStreak(streak: Streak, now: number): Streak {
  const today = dayKey(now);
  if (streak.lastDay === today) return streak;
  const yesterday = dayKey(now - 24 * 60 * 60 * 1000);
  const current = streak.lastDay === yesterday ? streak.current + 1 : 1;
  return { current, lastDay: today };
}

/** Pure: returns a new state with one answer recorded. */
export function recordAnswer(state: ProgressState, itemId: string, grade: Grade, now: number): ProgressState {
  const prev = state.items[itemId] ?? newProgress(now);
  return {
    ...state,
    items: { ...state.items, [itemId]: review(prev, grade, now) },
    streak: bumpStreak(state.streak, now),
    updatedAt: now,
  };
}

export function serialise(state: ProgressState): string {
  return JSON.stringify({ ...state, exportedAt: new Date(state.updatedAt || Date.now()).toISOString() }, null, 2);
}

export function parseState(text: string): ProgressState {
  const raw: unknown = JSON.parse(text);
  if (!raw || typeof raw !== 'object') throw new Error('Not a progress file');
  const obj = raw as Partial<ProgressState>;
  if (obj.version !== 1 || typeof obj.items !== 'object' || obj.items === null) {
    throw new Error('Not a progress file (missing version 1 or items)');
  }
  const items: Record<string, ItemProgress> = {};
  for (const [id, p] of Object.entries(obj.items)) {
    if (!p || typeof p !== 'object') continue;
    const q = p as Partial<ItemProgress>;
    if (typeof q.due !== 'number' || typeof q.last !== 'number') continue;
    items[id] = { ...newProgress(q.due), ...q } as ItemProgress;
  }
  return {
    version: 1,
    items,
    settings: { ...DEFAULT_SETTINGS, ...(obj.settings ?? {}) },
    streak: { current: obj.streak?.current ?? 0, lastDay: obj.streak?.lastDay ?? null },
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : 0,
  };
}

/**
 * Merge an imported state into the current one. Per item, the more recently
 * answered copy wins, so a laptop export and a phone export can be combined.
 * Local settings are kept.
 */
export function mergeStates(local: ProgressState, incoming: ProgressState): { state: ProgressState; imported: number } {
  const items = { ...local.items };
  let imported = 0;
  for (const [id, theirs] of Object.entries(incoming.items)) {
    const mine = items[id];
    if (!mine || theirs.last > mine.last) {
      items[id] = theirs;
      imported++;
    }
  }
  const streak = incoming.streak.current > local.streak.current ? incoming.streak : local.streak;
  return { state: { ...local, items, streak, updatedAt: Math.max(local.updatedAt, incoming.updatedAt) }, imported };
}

// ---- Browser-side store -------------------------------------------------

let state: ProgressState | null = null;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function getState(): ProgressState {
  if (state) return state;
  const raw = storage()?.getItem(STORAGE_KEY);
  if (raw) {
    try {
      state = parseState(raw);
    } catch {
      state = emptyState();
    }
  } else {
    state = emptyState();
  }
  return state;
}

export function setState(next: ProgressState): void {
  state = next;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: keep going in memory.
  }
  for (const l of listeners) l();
}

export function update(fn: (s: ProgressState) => ProgressState): void {
  setState(fn(getState()));
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProgress(): ProgressState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function answer(itemId: string, grade: Grade, now = Date.now()): void {
  update((s) => recordAnswer(s, itemId, grade, now));
}

export function setSettings(patch: Partial<Settings>): void {
  update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function resetAll(): void {
  setState(emptyState());
}

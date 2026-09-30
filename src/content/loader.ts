import type { Item, Unit } from './types';
import { CURRICULUM } from './curriculum';

// Every unit file is bundled into the app at build time, so the content is
// available offline and there are no runtime fetches.
const modules = import.meta.glob<Unit>('../../content/units/*.json', {
  eager: true,
  import: 'default',
});

const loaded: Unit[] = Object.values(modules).sort((a, b) => a.order - b.order);

const byId = new Map<string, Unit>(loaded.map((u) => [u.id, u]));
const itemsById = new Map<string, Item>();
for (const unit of loaded) for (const item of unit.items) itemsById.set(item.id, item);

export function allUnits(): Unit[] {
  return loaded;
}

export function getUnit(id: string): Unit | undefined {
  return byId.get(id);
}

export function getItem(id: string): Item | undefined {
  return itemsById.get(id);
}

export function allItems(): Item[] {
  return [...itemsById.values()];
}

/** Curriculum entries in course order, each with its content unit if one exists. */
export function curriculumWithContent() {
  return CURRICULUM.map((planned) => ({ planned, unit: byId.get(planned.id) }));
}

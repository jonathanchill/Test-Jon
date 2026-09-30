import type { Item } from '../content/types';
import type { Grade } from '../engine/srs';
import { TypedAnswer } from './TypedAnswer';

export function Translate({ item, onGrade }: { item: Item; onGrade: (g: Grade) => void }) {
  return <TypedAnswer item={item} onGrade={onGrade} label="Say it in French" prompt={item.en} promptIsFrench={false} />;
}

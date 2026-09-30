import type { Item } from '../content/types';
import type { Grade } from '../engine/srs';
import { TypedAnswer } from './TypedAnswer';

export function Transform({ item, onGrade }: { item: Item; onGrade: (g: Grade) => void }) {
  return (
    <TypedAnswer item={item} onGrade={onGrade} label="Rewrite it" prompt={item.prompt_fr ?? ''} promptIsFrench hint={item.en} placeholder="Type the new sentence" />
  );
}

import type { Item } from '../content/types';
import type { Grade } from '../engine/srs';
import { TypedAnswer } from './TypedAnswer';

export function ErrorSpot({ item, onGrade }: { item: Item; onGrade: (g: Grade) => void }) {
  return (
    <TypedAnswer
      item={item}
      onGrade={onGrade}
      label="This sentence has one mistake. Type the corrected sentence."
      prompt={item.prompt_fr ?? ''}
      promptIsFrench
      hint={item.en}
      placeholder="Type the whole sentence, corrected"
    />
  );
}

import type { Item } from '../content/types';
import type { Grade } from '../engine/srs';
import { Choice } from './Choice';
import { Dictation } from './Dictation';
import { Shadow } from './Shadow';
import { Speak } from './Speak';
import type { Variant } from '../engine/session';
import { ErrorSpot } from './ErrorSpot';
import { Flashcard } from './Flashcard';
import { GapFill } from './GapFill';
import { OpenPrompt } from './OpenPrompt';
import { Transform } from './Transform';
import { Translate } from './Translate';

interface Props {
  item: Item;
  /** For flashcards: which side to show first. */
  flashFront: 'fr' | 'en';
  onGrade: (grade: Grade) => void;
  /** shadow: hear and repeat, no grading. speak: say it, speech recognition checks. */
  variant?: Variant;
}

/** Picks the right exercise component for an item's type. */
export function Exercise({ item, flashFront, onGrade, variant }: Props) {
  if (variant === 'shadow') return <Shadow key={item.id} item={item} onNext={() => onGrade(4)} />;
  if (variant === 'speak') return <Speak key={item.id} item={item} onGrade={onGrade} />;
  switch (item.type) {
    case 'flashcard':
      return <Flashcard key={item.id} item={item} front={flashFront} onGrade={onGrade} />;
    case 'gapfill':
      return <GapFill key={item.id} item={item} onGrade={onGrade} />;
    case 'choice':
      return <Choice key={item.id} item={item} onGrade={onGrade} />;
    case 'transform':
      return <Transform key={item.id} item={item} onGrade={onGrade} />;
    case 'errorspot':
      return <ErrorSpot key={item.id} item={item} onGrade={onGrade} />;
    case 'translate':
      return <Translate key={item.id} item={item} onGrade={onGrade} />;
    case 'open':
      return <OpenPrompt key={item.id} item={item} onGrade={onGrade} />;
    case 'dictation':
      return <Dictation key={item.id} item={item} onGrade={onGrade} />;
  }
}

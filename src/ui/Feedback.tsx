import type { CheckResult } from '../engine/answerCheck';
import type { Item } from '../content/types';
import { CheckMarker } from './Tags';

export function Feedback({ result, expected, item }: { result: CheckResult; expected: string; item: Item }) {
  const heading = result === 'correct' ? 'Correct' : result === 'nearly' ? 'Nearly: watch the accent' : 'Not quite';
  return (
    <div className={`feedback feedback-${result}`} role="status">
      <p className="feedback-heading">{heading}</p>
      {result !== 'correct' && (
        <p className="feedback-expected">
          <span className="fr">{expected}</span>
        </p>
      )}
      <p className="feedback-full">
        <span className="fr">{item.fr}</span> <span className="muted">{item.en}</span>
      </p>
      {item.note && <p className="feedback-note">{item.note}</p>}
      <CheckMarker item={item} />
    </div>
  );
}

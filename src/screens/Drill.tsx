import { type ReactNode, useCallback, useMemo, useState } from 'react';
import type { Item } from '../content/types';
import { answer, getState, type ProgressState } from '../engine/progress';
import type { Grade } from '../engine/srs';
import { Exercise } from '../exercises/Exercise';

interface Tally {
  correct: number;
  nearly: number;
  wrong: number;
}

interface Props {
  title: string;
  crumbs: ReactNode;
  /** Builds the queue for a given seed. Called again on "Again". */
  build: (state: ProgressState, seed: number) => Item[];
  flashFront: 'fr' | 'en';
  /** Where "Back" goes. */
  backHref: string;
  backLabel: string;
  emptyMessage: string;
  /** Shadowing: hear and repeat, nothing recorded. */
  shadow?: boolean;
}

/** Generic drill runner: a queue of items, one exercise at a time, then a summary. */
export function Drill({ title, crumbs, build, flashFront, backHref, backLabel, emptyMessage, shadow }: Props) {
  const [seed, setSeed] = useState(() => Date.now());
  const queue = useMemo(() => build(getState(), seed), [build, seed]);
  const [index, setIndex] = useState(0);
  const [tally, setTally] = useState<Tally>({ correct: 0, nearly: 0, wrong: 0 });

  const onGrade = useCallback(
    (grade: Grade) => {
      const item = queue[index];
      if (!item) return;
      if (!shadow) answer(item.id, grade);
      setTally((t) => ({
        correct: t.correct + (grade >= 4 ? 1 : 0),
        nearly: t.nearly + (grade === 3 ? 1 : 0),
        wrong: t.wrong + (grade === 0 ? 1 : 0),
      }));
      setIndex((i) => i + 1);
    },
    [queue, index, shadow],
  );

  function restart() {
    setSeed(Date.now());
    setIndex(0);
    setTally({ correct: 0, nearly: 0, wrong: 0 });
  }

  const item: Item | undefined = queue[index];
  const done = queue.length === 0 || index >= queue.length;

  return (
    <div className="screen">
      <p className="crumbs">{crumbs}</p>
      <div className="drill-header">
        <span className="muted">{title}</span>
        <span className="muted">
          {Math.min(index + 1, queue.length)} / {queue.length}
        </span>
      </div>
      <div className="progress-bar" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${queue.length ? (index / queue.length) * 100 : 0}%` }} />
      </div>

      {done ? (
        <div className="summary">
          <h2>{queue.length === 0 ? 'Nothing to do here' : 'Done'}</h2>
          {queue.length === 0 ? (
            <p className="muted">{emptyMessage}</p>
          ) : shadow ? (
            <p className="muted">{queue.length} phrases shadowed. Nothing is recorded in shadowing mode.</p>
          ) : (
            <ul className="summary-list">
              <li>{tally.correct} correct</li>
              <li>{tally.nearly} nearly</li>
              <li>
                {tally.wrong} wrong{tally.wrong > 0 && <span className="muted"> (added to your mistake bank)</span>}
              </li>
            </ul>
          )}
          <div className="mode-list">
            {queue.length > 0 && (
              <button className="btn btn-primary btn-block" onClick={restart} autoFocus>
                Again
              </button>
            )}
            <a className="btn btn-block" href={backHref}>
              {backLabel}
            </a>
          </div>
        </div>
      ) : (
        <Exercise item={item} flashFront={flashFront} onGrade={onGrade} shadow={shadow} />
      )}
    </div>
  );
}

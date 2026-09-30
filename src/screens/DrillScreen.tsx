import { useCallback, useMemo, useState } from 'react';
import { getUnit } from '../content/loader';
import type { Item } from '../content/types';
import { answer, getState } from '../engine/progress';
import { MODE_LABELS, type Mode, buildUnitSession } from '../engine/session';
import type { Grade } from '../engine/srs';
import { Flashcard } from '../exercises/Flashcard';
import { GapFill } from '../exercises/GapFill';
import { href } from '../router';
import { NotFound } from './NotFound';

interface Tally {
  correct: number;
  nearly: number;
  wrong: number;
}

export function DrillScreen({ id, mode }: { id: string; mode: Mode }) {
  const unit = getUnit(id);
  const [seed, setSeed] = useState(() => Date.now());
  const queue = useMemo(() => (unit ? buildUnitSession(unit, mode, getState(), seed) : []), [unit, mode, seed]);
  const [index, setIndex] = useState(0);
  const [tally, setTally] = useState<Tally>({ correct: 0, nearly: 0, wrong: 0 });

  const onGrade = useCallback(
    (grade: Grade) => {
      const item = queue[index];
      if (!item) return;
      answer(item.id, grade);
      setTally((t) => ({
        correct: t.correct + (grade >= 4 ? 1 : 0),
        nearly: t.nearly + (grade === 3 ? 1 : 0),
        wrong: t.wrong + (grade === 0 ? 1 : 0),
      }));
      setIndex((i) => i + 1);
    },
    [queue, index],
  );

  if (!unit) return <NotFound what={`unit "${id}"`} />;

  function restart() {
    setSeed(Date.now());
    setIndex(0);
    setTally({ correct: 0, nearly: 0, wrong: 0 });
  }

  const item: Item | undefined = queue[index];
  const done = queue.length === 0 || index >= queue.length;

  return (
    <div className="screen">
      <p className="crumbs">
        <a href={href({ name: 'home' })}>Units</a> › <a href={href({ name: 'unit', id: unit.id })}>{unit.title}</a>
      </p>
      <div className="drill-header">
        <span className="muted">{MODE_LABELS[mode]}</span>
        <span className="muted">
          {Math.min(index + 1, queue.length)} / {queue.length}
        </span>
      </div>
      <div className="progress-bar" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${queue.length ? (index / queue.length) * 100 : 0}%` }} />
      </div>

      {done ? (
        <div className="summary">
          <h2>{queue.length === 0 ? 'Nothing to drill here yet' : 'Done'}</h2>
          {queue.length > 0 && (
            <ul className="summary-list">
              <li>{tally.correct} correct</li>
              <li>{tally.nearly} nearly</li>
              <li>{tally.wrong} wrong{tally.wrong > 0 && <span className="muted"> (added to your mistake bank)</span>}</li>
            </ul>
          )}
          <div className="mode-list">
            <button className="btn btn-primary btn-block" onClick={restart} autoFocus>
              Again
            </button>
            <a className="btn btn-block" href={href({ name: 'unit', id: unit.id })}>
              Back to the unit
            </a>
          </div>
        </div>
      ) : item.type === 'flashcard' ? (
        <Flashcard key={item.id} item={item} front={mode === 'flash-en' ? 'en' : 'fr'} onGrade={onGrade} />
      ) : (
        <GapFill key={item.id} item={item} onGrade={onGrade} />
      )}
    </div>
  );
}

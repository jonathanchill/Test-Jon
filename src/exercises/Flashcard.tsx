import { useEffect, useState } from 'react';
import type { Item } from '../content/types';
import type { Grade } from '../engine/srs';
import { CheckMarker } from '../ui/Tags';

interface Props {
  item: Item;
  /** Which side to show first. */
  front: 'fr' | 'en';
  onGrade: (grade: Grade) => void;
}

const GRADES: { key: string; grade: Grade; label: string }[] = [
  { key: '1', grade: 0, label: 'Again' },
  { key: '2', grade: 3, label: 'Hard' },
  { key: '3', grade: 4, label: 'Good' },
  { key: '4', grade: 5, label: 'Easy' },
];

export function Flashcard({ item, front, onGrade }: Props) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setFlipped(false);
  }, [item.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (!flipped && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setFlipped(true);
        return;
      }
      if (flipped) {
        const g = GRADES.find((x) => x.key === e.key);
        if (g) {
          e.preventDefault();
          onGrade(g.grade);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          onGrade(4);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipped, onGrade]);

  const frontText = front === 'fr' ? item.fr : item.en;
  const backText = front === 'fr' ? item.en : item.fr;

  return (
    <div className="exercise">
      <p className="prompt-label">{front === 'fr' ? 'What does this mean?' : 'How do you say this in French?'}</p>
      <p className={`card-front ${front === 'fr' ? 'fr' : ''}`}>{frontText}</p>
      {!flipped ? (
        <button className="btn btn-primary btn-block" onClick={() => setFlipped(true)} autoFocus>
          Show answer <kbd>Space</kbd>
        </button>
      ) : (
        <>
          <p className={`card-back ${front === 'en' ? 'fr' : ''}`}>{backText}</p>
          {item.note && <p className="feedback-note">{item.note}</p>}
          <CheckMarker item={item} />
          <p className="prompt-label">How well did you know it?</p>
          <div className="grade-row">
            {GRADES.map((g) => (
              <button key={g.key} className={`btn grade-${g.grade}`} onClick={() => onGrade(g.grade)}>
                {g.label} <kbd>{g.key}</kbd>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

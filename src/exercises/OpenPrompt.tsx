import { useEffect, useState } from 'react';
import type { Item } from '../content/types';
import type { Grade } from '../engine/srs';
import { CheckMarker } from '../ui/Tags';

const MARKS: { key: string; grade: Grade; label: string }[] = [
  { key: '1', grade: 0, label: 'Not really' },
  { key: '2', grade: 3, label: 'Partly' },
  { key: '3', grade: 4, label: 'Yes' },
];

export function OpenPrompt({ item, onGrade }: { item: Item; onGrade: (g: Grade) => void }) {
  const [text, setText] = useState('');
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setText('');
    setRevealed(false);
  }, [item.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!revealed) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      const m = MARKS.find((x) => x.key === e.key);
      if (m) {
        e.preventDefault();
        onGrade(m.grade);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, onGrade]);

  return (
    <div className="exercise">
      <p className="prompt-label">Write it</p>
      <p className="open-prompt">{item.prompt_fr}</p>
      <textarea
        className="text-area"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={revealed}
        lang="fr"
        autoCapitalize="sentences"
        spellCheck={false}
        placeholder="Write in French"
        aria-label="your answer"
        autoFocus
      />
      {!revealed ? (
        <button className="btn btn-primary btn-block" onClick={() => setRevealed(true)}>
          Show a model answer
        </button>
      ) : (
        <>
          <div className="feedback">
            <p className="feedback-heading">Model answer</p>
            <p className="feedback-expected">
              <span className="fr">{item.model}</span>
            </p>
            {item.note && <p className="feedback-note">{item.note}</p>}
            <CheckMarker item={item} />
          </div>
          <p className="prompt-label">Did yours say the same thing, with the same grammar?</p>
          <div className="grade-row grade-row-3">
            {MARKS.map((m) => (
              <button key={m.key} className={`btn grade-${m.grade}`} onClick={() => onGrade(m.grade)}>
                {m.label} <kbd>{m.key}</kbd>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

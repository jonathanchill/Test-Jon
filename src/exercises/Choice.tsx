import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item } from '../content/types';
import { normalise } from '../engine/answerCheck';
import { shuffle } from '../engine/session';
import type { Grade } from '../engine/srs';
import { useAutoSpeak, useReplayKey } from '../audio/tts';
import { useProgress } from '../engine/progress';
import { Feedback } from '../ui/Feedback';
import { Speaker } from '../ui/Speaker';

interface Props {
  item: Item;
  onGrade: (grade: Grade) => void;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function Choice({ item, onGrade }: Props) {
  const choices = useMemo(() => shuffle(item.choices ?? [], hash(item.id)), [item.id, item.choices]);
  const [picked, setPicked] = useState<string | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const answers = item.answers ?? [];
  const correct = picked !== null && answers.some((a) => normalise(a) === normalise(picked));
  const { settings } = useProgress();
  const byEar = (item.tags?.includes('ear') ?? false) && item.tts;
  useAutoSpeak(byEar ? item.fr : null, picked === null, settings.speed, settings.nativeSpeed);
  useReplayKey(item.tts ? item.fr : null, settings.speed, settings.nativeSpeed);

  useEffect(() => setPicked(null), [item.id]);
  useEffect(() => {
    if (picked !== null) nextRef.current?.focus();
  }, [picked]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (picked !== null) return;
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length) {
        e.preventDefault();
        setPicked(choices[n - 1]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picked, choices]);

  return (
    <div className="exercise">
      <p className="prompt-label">{byEar ? 'Listen, then pick what you heard' : 'Pick the right one'}</p>
      {byEar && picked === null && <Speaker text={item.fr} big label="Play again" />}
      {item.prompt_fr && <p className="card-front fr">{item.prompt_fr}</p>}
      <p className="muted hint">{item.en}</p>
      <div className="choice-list">
        {choices.map((c, i) => {
          const isAnswer = answers.some((a) => normalise(a) === normalise(c));
          const cls = picked === null ? '' : isAnswer ? 'choice-correct' : picked === c ? 'choice-wrong' : 'choice-dim';
          return (
            <button key={c} className={`btn btn-block choice-btn ${cls}`} disabled={picked !== null} onClick={() => setPicked(c)}>
              <kbd>{i + 1}</kbd> <span className="fr">{c}</span>
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <>
          <Feedback result={correct ? 'correct' : 'wrong'} expected={answers[0]} item={item} />
          <button ref={nextRef} className="btn btn-primary btn-block" onClick={() => onGrade(correct ? 4 : 0)}>
            Next <kbd>Enter</kbd>
          </button>
        </>
      )}
    </div>
  );
}

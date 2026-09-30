import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { Item } from '../content/types';
import { type CheckOutcome, checkAnswer, gapfillAnswers } from '../engine/answerCheck';
import { gradeFromResult, type Grade } from '../engine/srs';
import { Feedback } from '../ui/Feedback';

interface Props {
  item: Item;
  onGrade: (grade: Grade) => void;
}

export function GapFill({ item, onGrade }: Props) {
  const [value, setValue] = useState('');
  const [outcome, setOutcome] = useState<CheckOutcome | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setValue('');
    setOutcome(null);
    inputRef.current?.focus();
  }, [item.id]);

  useEffect(() => {
    if (outcome) nextRef.current?.focus();
  }, [outcome]);

  const prompt = item.prompt_fr ?? '';
  const answers = item.answers ?? [];
  const [before, after] = prompt.split('___');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (outcome) return;
    setOutcome(checkAnswer(value, gapfillAnswers(prompt, answers)));
  }

  function next() {
    if (!outcome) return;
    onGrade(gradeFromResult(outcome.result));
  }

  return (
    <div className="exercise">
      <p className="prompt-label">Fill the gap</p>
      <form onSubmit={submit} className="gap-form">
        <p className="gap-sentence fr">
          {before}
          <input
            ref={inputRef}
            className={`gap-input ${outcome ? `gap-${outcome.result}` : ''}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={outcome !== null}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            lang="fr"
            aria-label="missing word"
            size={Math.max(6, (answers[0]?.length ?? 6) + 2)}
          />
          {after}
        </p>
        <p className="muted hint">{item.en}</p>
        {!outcome ? (
          <button type="submit" className="btn btn-primary btn-block">
            Check <kbd>Enter</kbd>
          </button>
        ) : (
          <>
            <Feedback result={outcome.result} expected={outcome.expected} item={item} />
            <button type="button" ref={nextRef} className="btn btn-primary btn-block" onClick={next}>
              Next <kbd>Enter</kbd>
            </button>
          </>
        )}
      </form>
    </div>
  );
}

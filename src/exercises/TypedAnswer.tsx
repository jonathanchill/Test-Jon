import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { Item } from '../content/types';
import { type CheckOutcome, checkAnswer } from '../engine/answerCheck';
import { type Grade, gradeFromResult } from '../engine/srs';
import { Feedback } from '../ui/Feedback';

interface Props {
  item: Item;
  onGrade: (grade: Grade) => void;
  /** Small label above the prompt. */
  label: string;
  /** The text shown as the prompt. */
  prompt: string;
  promptIsFrench: boolean;
  /** Optional hint under the prompt. */
  hint?: string;
  placeholder?: string;
}

/** Shared shell for translate, transform, error-spotting and (later) dictation: type the full French. */
export function TypedAnswer({ item, onGrade, label, prompt, promptIsFrench, hint, placeholder }: Props) {
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

  function submit(e: FormEvent) {
    e.preventDefault();
    if (outcome) return;
    setOutcome(checkAnswer(value, item.answers ?? [item.fr]));
  }

  return (
    <div className="exercise">
      <p className="prompt-label">{label}</p>
      <p className={`card-front ${promptIsFrench ? 'fr' : ''}`}>{prompt}</p>
      {hint && <p className="muted hint">{hint}</p>}
      <form onSubmit={submit} className="gap-form">
        <input
          ref={inputRef}
          className={`text-input ${outcome ? `gap-${outcome.result}` : ''}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={outcome !== null}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          lang="fr"
          placeholder={placeholder ?? 'Type the French'}
          aria-label="your answer"
        />
        {!outcome ? (
          <button type="submit" className="btn btn-primary btn-block">
            Check <kbd>Enter</kbd>
          </button>
        ) : (
          <>
            <Feedback result={outcome.result} expected={outcome.expected} item={item} />
            <button type="button" ref={nextRef} className="btn btn-primary btn-block" onClick={() => onGrade(gradeFromResult(outcome.result))}>
              Next <kbd>Enter</kbd>
            </button>
          </>
        )}
      </form>
    </div>
  );
}

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useAutoSpeak, useReplayKey } from '../audio/tts';
import type { Item } from '../content/types';
import { type CheckOutcome, checkAnswer } from '../engine/answerCheck';
import { useProgress } from '../engine/progress';
import { type Grade, gradeFromResult } from '../engine/srs';
import { Feedback } from '../ui/Feedback';
import { Speaker, SpeedControl, VoiceNotice } from '../ui/Speaker';

interface Props {
  item: Item;
  onGrade: (grade: Grade) => void;
}

/** Hear a phrase, type what you heard. Nothing is shown until you answer. */
export function Dictation({ item, onGrade }: Props) {
  const { settings } = useProgress();
  const [value, setValue] = useState('');
  const [outcome, setOutcome] = useState<CheckOutcome | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const isNumber = item.tags?.includes('numbers') ?? false;

  useEffect(() => {
    setValue('');
    setOutcome(null);
    inputRef.current?.focus();
  }, [item.id]);

  useEffect(() => {
    if (outcome) nextRef.current?.focus();
  }, [outcome]);

  useAutoSpeak(item.fr, outcome === null, settings.speed, settings.nativeSpeed);
  useReplayKey(item.fr, settings.speed, settings.nativeSpeed);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (outcome) return;
    setOutcome(checkAnswer(value, item.answers ?? [item.fr]));
  }

  return (
    <div className="exercise">
      <p className="prompt-label">{isNumber ? 'Listen and type the number in digits' : 'Listen and type what you hear'}</p>
      <VoiceNotice />
      <div className="listen-row">
        <Speaker text={item.fr} big label="Play" />
        <SpeedControl />
      </div>
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
          inputMode={isNumber ? 'numeric' : 'text'}
          placeholder={isNumber ? 'Digits' : 'What did you hear?'}
          aria-label="what you heard"
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

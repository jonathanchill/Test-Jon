import { useEffect, useRef, useState } from 'react';
import { bestOutcome, listenOnce, recognitionSupported, type ListenHandle } from '../audio/recognition';
import { useReplayKey } from '../audio/tts';
import type { Item } from '../content/types';
import type { CheckOutcome } from '../engine/answerCheck';
import { useProgress } from '../engine/progress';
import { type Grade, gradeFromResult } from '../engine/srs';
import { Feedback } from '../ui/Feedback';
import { Speaker } from '../ui/Speaker';

interface Props {
  item: Item;
  onGrade: (grade: Grade) => void;
}

type Phase = 'idle' | 'listening' | 'done';

/** Say the French out loud; speech recognition checks it against the accepted answers. */
export function Speak({ item, onGrade }: Props) {
  const { settings } = useProgress();
  const [phase, setPhase] = useState<Phase>('idle');
  const [heard, setHeard] = useState('');
  const [outcome, setOutcome] = useState<CheckOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handle = useRef<ListenHandle | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const supported = recognitionSupported();
  const answers = item.answers ?? [item.fr];

  useEffect(() => {
    setPhase('idle');
    setHeard('');
    setOutcome(null);
    setError(null);
    return () => handle.current?.stop();
  }, [item.id]);

  useEffect(() => {
    if (phase === 'done') nextRef.current?.focus();
  }, [phase]);

  useReplayKey(item.tts ? item.fr : null, settings.speed, settings.nativeSpeed);

  function start() {
    setError(null);
    setPhase('listening');
    handle.current = listenOnce(
      (alts) => {
        if (alts.length === 0) {
          setError("Didn't catch anything. Try again, a little louder.");
          setPhase('idle');
          return;
        }
        const best = bestOutcome(alts, answers);
        setHeard(best.heard);
        setOutcome(best.outcome);
        setPhase('done');
      },
      (err) => {
        setError(err === 'not-allowed' ? 'Microphone access was refused. Allow it in the browser and try again.' : err === 'no-speech' ? "Didn't hear anything. Try again." : `Recognition error: ${err}`);
        setPhase('idle');
      },
    );
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ' && phase === 'idle' && supported) {
        e.preventDefault();
        start();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, supported, item.id]);

  return (
    <div className="exercise">
      <p className="prompt-label">Say it in French</p>
      <p className="card-front">{item.en}</p>
      {!supported && (
        <p className="notice" role="status">
          This browser cannot recognise speech. Chrome on a laptop or Android phone can. You can still practise: say it out loud, then reveal the answer and mark yourself.
        </p>
      )}
      {error && (
        <p className="notice" role="status">
          {error}
        </p>
      )}
      {phase !== 'done' && (
        <div className="mode-list">
          {supported ? (
            <button className="btn btn-primary btn-block" onClick={start} disabled={phase === 'listening'}>
              {phase === 'listening' ? 'Listening…' : 'Speak'} <kbd>Space</kbd>
            </button>
          ) : (
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                setOutcome(null);
                setPhase('done');
              }}
            >
              Reveal the answer
            </button>
          )}
        </div>
      )}
      {phase === 'done' && outcome && (
        <>
          <p className="muted">
            Heard: <span className="fr">{heard}</span>
          </p>
          <Feedback result={outcome.result} expected={outcome.expected} item={item} />
          <button ref={nextRef} className="btn btn-primary btn-block" onClick={() => onGrade(gradeFromResult(outcome.result))}>
            Next <kbd>Enter</kbd>
          </button>
        </>
      )}
      {phase === 'done' && !outcome && (
        <>
          <div className="feedback">
            <p className="feedback-heading">Answer</p>
            <p className="feedback-expected">
              {item.tts && <Speaker text={item.fr} />} <span className="fr">{item.fr}</span>
            </p>
            {item.note && <p className="feedback-note">{item.note}</p>}
          </div>
          <p className="prompt-label">Did you say it right?</p>
          <div className="grade-row grade-row-3">
            <button className="btn grade-0" onClick={() => onGrade(0)}>
              No <kbd>1</kbd>
            </button>
            <button className="btn" onClick={() => onGrade(3)}>
              Nearly <kbd>2</kbd>
            </button>
            <button className="btn grade-5" onClick={() => onGrade(4)}>
              Yes <kbd>3</kbd>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

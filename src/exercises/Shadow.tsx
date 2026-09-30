import { useEffect } from 'react';
import { useAutoSpeak, useReplayKey } from '../audio/tts';
import type { Item } from '../content/types';
import { useProgress } from '../engine/progress';
import { Speaker, SpeedControl, VoiceNotice } from '../ui/Speaker';
import { CheckMarker } from '../ui/Tags';

interface Props {
  item: Item;
  onNext: () => void;
}

/** Shadowing: hear it, say it back, move on. Nothing is graded. */
export function Shadow({ item, onNext }: Props) {
  const { settings } = useProgress();
  const hide = settings.audioOnly;
  useAutoSpeak(item.fr, true, settings.speed, settings.nativeSpeed);
  useReplayKey(item.fr, settings.speed, settings.nativeSpeed);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onNext();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext]);

  return (
    <div className="exercise">
      <p className="prompt-label">Listen, then say it back out loud</p>
      <VoiceNotice />
      {!hide && <p className="card-front fr">{item.fr}</p>}
      {!hide && <p className="muted hint">{item.en}</p>}
      {hide && <p className="muted hint">Audio only. Turn this off in Settings to see the text.</p>}
      {item.note && !hide && <p className="feedback-note">{item.note}</p>}
      <CheckMarker item={item} />
      <div className="listen-row">
        <Speaker text={item.fr} big label="Again" />
        <SpeedControl />
      </div>
      <button className="btn btn-primary btn-block" onClick={onNext}>
        Next <kbd>Enter</kbd>
      </button>
    </div>
  );
}

import { SPEEDS, speak, useVoiceStatus } from '../audio/tts';
import { setSettings, useProgress } from '../engine/progress';

interface Props {
  text: string;
  /** Larger, labelled button for dictation and shadowing. */
  big?: boolean;
  label?: string;
  autoFocus?: boolean;
}

/** A play button that reads French aloud at the speed chosen in Settings. */
export function Speaker({ text, big, label, autoFocus }: Props) {
  const { settings } = useProgress();
  const status = useVoiceStatus();
  if (status === 'unsupported') return null;
  const disabled = status !== 'ready';
  const title = status === 'none' ? 'No French voice installed on this device' : status === 'loading' ? 'Loading voices' : 'Listen';
  return (
    <button
      type="button"
      className={`btn speaker ${big ? 'speaker-big' : 'speaker-small'}`}
      onClick={() => speak(text, { speed: settings.speed, native: settings.nativeSpeed })}
      disabled={disabled}
      title={title}
      aria-label={label ?? 'Listen'}
      autoFocus={autoFocus}
    >
      <span aria-hidden="true">▶</span>
      {big && <span>{label ?? 'Listen again'}</span>}
      {big && <kbd>P</kbd>}
    </button>
  );
}

/** Banner shown when the device cannot read French aloud. */
export function VoiceNotice() {
  const status = useVoiceStatus();
  if (status === 'ready' || status === 'loading') return null;
  return (
    <p className="notice" role="status">
      {status === 'unsupported'
        ? 'This browser cannot read text aloud, so the audio drills will not play. Chrome, Safari and Edge all can.'
        : 'No French voice is installed on this device, so nothing will play. iPhone: Settings, Accessibility, Spoken Content, Voices, French. Android: Settings, System, Languages, Text-to-speech output, install French. Mac: System Settings, Accessibility, Spoken Content, System voice, Manage voices. Windows: Settings, Time & language, Language, add French with speech.'}
    </p>
  );
}

export function SpeedControl() {
  const { settings } = useProgress();
  const native = settings.nativeSpeed;
  return (
    <div className="speed-row" role="group" aria-label="Playback speed">
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          className={`btn btn-small ${!native && settings.speed === s ? 'btn-primary' : ''}`}
          onClick={() => setSettings({ speed: s, nativeSpeed: false })}
        >
          {s}×
        </button>
      ))}
      <button type="button" className={`btn btn-small ${native ? 'btn-primary' : ''}`} onClick={() => setSettings({ nativeSpeed: !native })} title="Faster than the fastest preset">
        Native
      </button>
    </div>
  );
}

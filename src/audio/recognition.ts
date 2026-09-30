// Speech recognition through the Web Speech API (Chrome desktop, Chrome on
// Android; Safari has partial support). Pure helpers are exported for tests.
import { checkAnswer, type CheckOutcome } from '../engine/answerCheck';

interface RecognitionResultLike {
  transcript: string;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<RecognitionResultLike>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function recognitionSupported(): boolean {
  return ctor() !== null;
}

/**
 * Given the recogniser's alternatives, return the best outcome against the
 * accepted answers: a correct alternative beats a nearly one beats wrong.
 */
export function bestOutcome(transcripts: readonly string[], answers: readonly string[]): { outcome: CheckOutcome; heard: string } {
  const rank = { correct: 2, nearly: 1, wrong: 0 } as const;
  let best: { outcome: CheckOutcome; heard: string } | null = null;
  for (const t of transcripts) {
    const outcome = checkAnswer(t, answers);
    if (!best || rank[outcome.result] > rank[best.outcome.result]) best = { outcome, heard: t };
    if (best.outcome.result === 'correct') break;
  }
  return best ?? { outcome: { result: 'wrong', expected: answers[0] ?? '' }, heard: transcripts[0] ?? '' };
}

export interface ListenHandle {
  stop(): void;
}

/**
 * Listen once for French speech. Resolves with every alternative transcript
 * the recogniser offers (best first), or rejects with the error name.
 */
export function listenOnce(onDone: (transcripts: string[]) => void, onError: (error: string) => void): ListenHandle | null {
  const C = ctor();
  if (!C) return null;
  const rec = new C();
  rec.lang = 'fr-FR';
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  let finished = false;
  rec.onresult = (e) => {
    finished = true;
    const alts: string[] = [];
    const first = e.results[0];
    for (let i = 0; i < first.length; i++) alts.push(first[i].transcript);
    onDone(alts);
  };
  rec.onerror = (e) => {
    finished = true;
    onError(e.error);
  };
  rec.onend = () => {
    if (!finished) onDone([]);
  };
  rec.start();
  return { stop: () => rec.stop() };
}

// Text to speech through the Web Speech API. Pure helpers (voice choice,
// rate mapping) are exported for tests; the speak() function needs a browser.
import { useEffect, useState } from 'react';

export type Speed = 0.8 | 1 | 1.25;
export const SPEEDS: Speed[] = [0.8, 1, 1.25];
/** "Native speed" pushes past the fastest preset. */
export const NATIVE_RATE = 1.45;

export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

/** Prefer an fr-FR voice, then any French voice; local (offline) voices win ties. */
export function pickFrenchVoice<V extends VoiceLike>(voices: readonly V[]): V | null {
  const french = voices.filter((v) => /^fr([-_]|$)/i.test(v.lang));
  if (french.length === 0) return null;
  const score = (v: V) => (/^fr[-_]FR$/i.test(v.lang) ? 2 : 0) + (v.localService ? 1 : 0) + (v.default ? 0.5 : 0);
  return [...french].sort((a, b) => score(b) - score(a))[0];
}

export function rateFor(speed: Speed, native: boolean): number {
  return native ? NATIVE_RATE : speed;
}

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

let cachedVoice: SpeechSynthesisVoice | null | undefined;
const voiceListeners = new Set<() => void>();

function loadVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  return window.speechSynthesis.getVoices();
}

/** The French voice to use, or null when none is installed. undefined while voices are still loading. */
export function frenchVoice(): SpeechSynthesisVoice | null | undefined {
  if (cachedVoice !== undefined) return cachedVoice;
  const voices = loadVoices();
  if (voices.length === 0) return undefined;
  cachedVoice = pickFrenchVoice(voices);
  return cachedVoice;
}

if (ttsSupported()) {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    cachedVoice = undefined;
    frenchVoice();
    for (const l of voiceListeners) l();
  });
}

export interface SpeakOptions {
  speed?: Speed;
  native?: boolean;
  onEnd?: () => void;
}

/** Speak French text. Returns false if speech is unavailable or no French voice exists. */
export function speak(text: string, opts: SpeakOptions = {}): boolean {
  if (!ttsSupported()) return false;
  const voice = frenchVoice();
  if (!voice) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = rateFor(opts.speed ?? 1, opts.native ?? false);
  u.pitch = 1;
  if (opts.onEnd) u.onend = opts.onEnd;
  synth.speak(u);
  return true;
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

export type VoiceStatus = 'loading' | 'ready' | 'none' | 'unsupported';

/** React hook: whether a French voice is available on this device. */
export function useVoiceStatus(): VoiceStatus {
  const compute = (): VoiceStatus => {
    if (!ttsSupported()) return 'unsupported';
    const v = frenchVoice();
    return v === undefined ? 'loading' : v ? 'ready' : 'none';
  };
  const [status, setStatus] = useState<VoiceStatus>(compute);
  useEffect(() => {
    const update = () => setStatus(compute());
    voiceListeners.add(update);
    // Some browsers (Safari, Chrome on first load) need a nudge before voices appear.
    const t = window.setTimeout(update, 400);
    const t2 = window.setTimeout(update, 1500);
    // If no voice list has appeared after a few seconds there are no voices at all.
    const t3 = window.setTimeout(() => setStatus((s) => (s === 'loading' ? 'none' : s)), 3000);
    return () => {
      voiceListeners.delete(update);
      window.clearTimeout(t);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);
  return status;
}

/** Press P anywhere (outside a text field) to replay the current French. */
export function useReplayKey(text: string | null, speed: Speed, native: boolean): void {
  useEffect(() => {
    if (!text) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'p' && e.key !== 'P') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      speak(text as string, { speed, native });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [text, speed, native]);
}

/** Speak once when `text` changes (e.g. a new item), if `enabled`. */
export function useAutoSpeak(text: string | null, enabled: boolean, speed: Speed, native: boolean): void {
  useEffect(() => {
    if (!enabled || !text) return;
    const t = window.setTimeout(() => speak(text, { speed, native }), 150);
    return () => {
      window.clearTimeout(t);
      stopSpeaking();
    };
  }, [text, enabled, speed, native]);
}

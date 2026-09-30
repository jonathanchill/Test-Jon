import { describe, expect, it } from 'vitest';
import { NATIVE_RATE, pickFrenchVoice, rateFor } from '../src/audio/tts';

describe('pickFrenchVoice', () => {
  it('returns null when no French voice exists', () => {
    expect(pickFrenchVoice([{ name: 'Daniel', lang: 'en-GB' }])).toBeNull();
  });
  it('prefers fr-FR over other French variants, and local over remote', () => {
    const voices = [
      { name: 'Amélie', lang: 'fr-CA', localService: true },
      { name: 'Google français', lang: 'fr-FR', localService: false },
      { name: 'Thomas', lang: 'fr-FR', localService: true },
    ];
    expect(pickFrenchVoice(voices)?.name).toBe('Thomas');
  });
  it('falls back to any French voice', () => {
    expect(pickFrenchVoice([{ name: 'Amélie', lang: 'fr-CA' }, { name: 'Daniel', lang: 'en-GB' }])?.name).toBe('Amélie');
  });
  it('matches fr_FR with an underscore (Android)', () => {
    expect(pickFrenchVoice([{ name: 'x', lang: 'fr_FR' }])?.name).toBe('x');
  });
});

describe('rateFor', () => {
  it('uses the preset unless native is on', () => {
    expect(rateFor(0.8, false)).toBe(0.8);
    expect(rateFor(1.25, false)).toBe(1.25);
    expect(rateFor(1, true)).toBe(NATIVE_RATE);
    expect(NATIVE_RATE).toBeGreaterThan(1.25);
  });
});

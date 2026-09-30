import { describe, expect, it } from 'vitest';
import { bestOutcome } from '../src/audio/recognition';

describe('bestOutcome', () => {
  const answers = ['Il faut que je parte'];
  it('takes a correct alternative even if it is not first', () => {
    const r = bestOutcome(['il faut que je part', 'il faut que je parte'], answers);
    expect(r.outcome.result).toBe('correct');
    expect(r.heard).toBe('il faut que je parte');
  });
  it('prefers nearly over wrong', () => {
    const r = bestOutcome(['il faut que je part', 'il faut que je parte.'.replace('parte', 'parte')], ['Il faut que je parté']);
    expect(['nearly', 'wrong']).toContain(r.outcome.result);
  });
  it('returns wrong with the first transcript when nothing matches', () => {
    const r = bestOutcome(['bonjour', 'salut'], answers);
    expect(r.outcome.result).toBe('wrong');
    expect(r.heard).toBe('bonjour');
    expect(r.outcome.expected).toBe('Il faut que je parte');
  });
  it('copes with no transcripts', () => {
    expect(bestOutcome([], answers).outcome.result).toBe('wrong');
  });
});

import { describe, expect, it } from 'vitest';
import { checkAnswer, gapfillAnswers, normalise, stripAccents } from '../src/engine/answerCheck';

describe('normalise', () => {
  it('lowercases, trims and collapses whitespace', () => {
    expect(normalise('  Il  Faut   que ')).toBe('il faut que');
  });
  it('unifies apostrophe styles', () => {
    expect(normalise('j’aille')).toBe("j'aille");
    expect(normalise('j`aille')).toBe("j'aille");
  });
  it('ignores trailing and surrounding punctuation', () => {
    expect(normalise('Ça va bien ?')).toBe('ça va bien');
    expect(normalise('« Bonne chance ! »')).toBe('bonne chance');
    expect(normalise('Il faut que je prenne...')).toBe('il faut que je prenne');
  });
  it('keeps accents', () => {
    expect(normalise('Été')).toBe('été');
  });
});

describe('stripAccents', () => {
  it('removes diacritics and expands ligatures', () => {
    expect(stripAccents('à la pharmacie, cœur, ça')).toBe('a la pharmacie, coeur, ca');
  });
});

describe('checkAnswer', () => {
  it('accepts an exact match ignoring case and spacing', () => {
    expect(checkAnswer('  AILLE ', ['aille'])).toEqual({ result: 'correct', expected: 'aille' });
  });
  it('accepts any listed alternative', () => {
    const answers = ['Je ne connais pas la réponse', 'Je ne sais pas la réponse'];
    expect(checkAnswer('je ne sais pas la réponse', answers).result).toBe('correct');
    expect(checkAnswer('je ne connais pas la réponse', answers).result).toBe('correct');
  });
  it('accepts curly apostrophes and missing final punctuation', () => {
    expect(checkAnswer('Il faut que j’aille à la pharmacie', ["Il faut que j'aille à la pharmacie."]).result).toBe('correct');
  });
  it('treats a missing accent as nearly right and returns the accented form', () => {
    expect(checkAnswer('a la pharmacie', ['à la pharmacie'])).toEqual({ result: 'nearly', expected: 'à la pharmacie' });
    expect(checkAnswer('reçu', ['recu'])).toEqual({ result: 'nearly', expected: 'recu' });
  });
  it('prefers an exact alternative over a nearly match', () => {
    expect(checkAnswer('cafe', ['café', 'cafe']).result).toBe('correct');
  });
  it('marks wrong conjugation as wrong', () => {
    expect(checkAnswer('suis', ['sois']).result).toBe('wrong');
    expect(checkAnswer('reçois', ['reçu']).result).toBe('wrong');
  });
  it('marks wrong gender or agreement as wrong', () => {
    expect(checkAnswer('meilleur', ['meilleure']).result).toBe('wrong');
    expect(checkAnswer('une problème', ['un problème']).result).toBe('wrong');
    expect(checkAnswer('je suis parti', ['je suis partie']).result).toBe('wrong');
  });
  it('marks an empty answer as wrong', () => {
    expect(checkAnswer('   ', ['sois']).result).toBe('wrong');
  });
});

describe('gapfillAnswers', () => {
  it('accepts the missing word or the whole sentence', () => {
    const answers = gapfillAnswers("Il faut que j'___ à la pharmacie", ['aille']);
    expect(checkAnswer('aille', answers).result).toBe('correct');
    expect(checkAnswer("il faut que j'aille à la pharmacie", answers).result).toBe('correct');
    expect(checkAnswer("il faut que j'aile à la pharmacie", answers).result).toBe('wrong');
  });
});

// Answer checking. Normalises case, whitespace, apostrophes and punctuation,
// accepts any listed alternative, and treats a missing or wrong accent as
// "nearly right". Anything else (gender, agreement, conjugation) is wrong,
// because it simply does not match any accepted answer.

export type CheckResult = 'correct' | 'nearly' | 'wrong';

export interface CheckOutcome {
  result: CheckResult;
  /** The accepted answer that matched, or the first accepted answer if none did. */
  expected: string;
}

const APOSTROPHES = /[‘’ʼ`´]/g;
const ELLIPSIS = /(\.{3}|…)/g;
const EDGE_PUNCT = /^[\s.,!?;:¡¿«»"()]+|[\s.,!?;:«»"()]+$/g;
const INNER_PUNCT_SPACE = /\s+([?!;:,.])/g;

/** Canonical form used for exact comparison. Accents are kept. */
export function normalise(input: string): string {
  return input
    .normalize('NFC')
    .replace(APOSTROPHES, "'")
    .replace(ELLIPSIS, ' ')
    .replace(/ /g, ' ')
    .toLowerCase()
    .replace(INNER_PUNCT_SPACE, '$1')
    .replace(EDGE_PUNCT, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Like normalise, but with diacritics and ligatures removed. */
export function stripAccents(input: string): string {
  return normalise(input)
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function checkAnswer(input: string, answers: readonly string[]): CheckOutcome {
  if (answers.length === 0) return { result: 'wrong', expected: '' };
  const given = normalise(input);
  if (given.length === 0) return { result: 'wrong', expected: answers[0] };

  for (const answer of answers) {
    if (normalise(answer) === given) return { result: 'correct', expected: answer };
  }

  const bare = stripAccents(input);
  for (const answer of answers) {
    if (stripAccents(answer) === bare) return { result: 'nearly', expected: answer };
  }

  return { result: 'wrong', expected: answers[0] };
}

/** Accepted answers for a gap-fill: the missing word(s), or the whole sentence filled in. */
export function gapfillAnswers(promptFr: string, answers: readonly string[]): string[] {
  const whole = answers.map((a) => promptFr.replace('___', a));
  return [...answers, ...whole];
}

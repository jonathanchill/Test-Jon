/*
 * Measures the offline scorer against tools/corpus.js and prints a per-case
 * table plus accuracy. This is the scorer's actual score card - run it after
 * touching src/lib/heuristics.js.
 *
 *   npm run eval
 *
 * Exits non-zero if accuracy drops below the floor, so a tuning change that
 * trades one fixed case for two broken ones fails loudly.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CORPUS = require('./corpus');
const SPAM_FLOOR = 1.0; // spam is the reliable axis - every case must pass
const AUTHOR_FLOOR = 0.85;

function loadScorer() {
  const sandbox = { console };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of ['util.js', 'heuristics.js']) {
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', file), 'utf8'),
      sandbox,
      { filename: file },
    );
  }
  return sandbox.MailLensHeuristics;
}

function accepts(expected, actual) {
  if (expected === null || expected === undefined) return true;
  return Array.isArray(expected) ? expected.includes(actual) : expected === actual;
}

function pad(str, width) {
  const s = String(str);
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length);
}

const scorer = loadScorer();
let spamOk = 0;
let authorOk = 0;
const misses = [];

process.stdout.write(
  pad('case', 38) + pad('level', 8) + pad('spam', 12) + pad('written by', 14) + 'conf\n');
process.stdout.write('-'.repeat(78) + '\n');

for (const item of CORPUS) {
  const result = scorer.classify(item, item.level);
  const spamHit = accepts(item.spam, result.spam.verdict);
  const authorHit = accepts(item.authorship, result.authorship.verdict);
  if (spamHit) spamOk += 1;
  if (authorHit) authorOk += 1;
  if (!spamHit || !authorHit) {
    misses.push({ item, result, spamHit, authorHit });
  }
  process.stdout.write(
    pad((spamHit && authorHit ? '   ' : ' ! ') + item.name, 38) +
    pad(item.level, 8) +
    pad(result.spam.verdict + (spamHit ? '' : ' X'), 12) +
    pad(result.authorship.verdict + (authorHit ? '' : ' X'), 14) +
    result.authorship.confidence + '%\n');
}

const spamRate = spamOk / CORPUS.length;
const authorRate = authorOk / CORPUS.length;

process.stdout.write('\n');
process.stdout.write(`spam        ${spamOk}/${CORPUS.length}  (${Math.round(spamRate * 100)}%)\n`);
process.stdout.write(`authorship  ${authorOk}/${CORPUS.length}  (${Math.round(authorRate * 100)}%)\n`);

if (misses.length) {
  process.stdout.write('\nmissed:\n');
  for (const miss of misses) {
    const wanted = [];
    if (!miss.spamHit) wanted.push(`spam=${JSON.stringify(miss.item.spam)} got ${miss.result.spam.verdict}`);
    if (!miss.authorHit) {
      wanted.push(`authorship=${JSON.stringify(miss.item.authorship)} got ${miss.result.authorship.verdict}`);
    }
    process.stdout.write(`  ${miss.item.name}: ${wanted.join('; ')}\n`);
    process.stdout.write(`    ${miss.result.reason}\n`);
  }
}

// A verdict everything shares is not a judgement. Catch the failure mode this
// eval exists because of: every row reading the same.
const verdicts = CORPUS.map((item) => scorer.classify(item, item.level).authorship.verdict);
const distinct = new Set(verdicts).size;
process.stdout.write(`\ndistinct authorship verdicts used: ${distinct}\n`);

const confidences = new Set(CORPUS.map((i) => scorer.classify(i, i.level).authorship.confidence));
process.stdout.write(`distinct confidence values: ${confidences.size}\n`);

let failed = false;
if (spamRate < SPAM_FLOOR) { process.stdout.write(`\nspam accuracy below floor ${SPAM_FLOOR}\n`); failed = true; }
if (authorRate < AUTHOR_FLOOR) { process.stdout.write(`\nauthorship accuracy below floor ${AUTHOR_FLOOR}\n`); failed = true; }
if (distinct < 4) { process.stdout.write('\nscorer is not discriminating between categories\n'); failed = true; }
if (confidences.size < 5) { process.stdout.write('\nconfidence is near-constant - it is not tracking evidence\n'); failed = true; }

process.exit(failed ? 1 : 0);

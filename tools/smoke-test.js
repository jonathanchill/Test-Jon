/*
 * Loads the unpacked extension into Chromium, serves tools/fixture-gmail.html in
 * place of mail.google.com, and checks that badges and the in-message card get
 * injected. Runs against the offline scorer - no API key, no network calls.
 *
 *   npm install playwright && node tools/smoke-test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixture-gmail.html'), 'utf8');

const failures = [];
function check(label, condition, detail) {
  const mark = condition ? 'PASS' : 'FAIL';
  process.stdout.write(`${mark}  ${label}${detail ? ' — ' + detail : ''}\n`);
  if (!condition) failures.push(label);
}

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-lens-'));
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    // Use whatever Chromium is already on the machine rather than the exact
    // build this playwright version pins.
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [
      `--disable-extensions-except=${ROOT}`,
      `--load-extension=${ROOT}`,
      '--no-sandbox',
    ],
  });

  try {
    const page = await context.newPage();
    await page.route('https://mail.google.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: FIXTURE }));
    // Nothing should reach Anthropic in this run; fail loudly if it does.
    let apiCalls = 0;
    await context.route('https://api.anthropic.com/**', (route) => {
      apiCalls += 1;
      route.abort();
    });

    await page.goto('https://mail.google.com/mail/u/0/#inbox');
    await page.waitForSelector('.ml-pill:not(.ml-pending)', { timeout: 20000 });
    await page.waitForSelector('.ml-card:not(.ml-pending)', { timeout: 20000 });
    await page.waitForTimeout(500);

    const pills = await page.$$eval('tr.zA', (rows) =>
      rows.map((row) => {
        const pill = row.querySelector('.ml-pill');
        return {
          subject: row.querySelector('.bog').textContent.trim(),
          text: pill ? pill.textContent.trim() : null,
          cls: pill ? pill.className : null,
          title: pill ? pill.title : null,
        };
      }));

    for (const pill of pills) process.stdout.write(`      row: "${pill.subject}" -> ${pill.text}\n`);

    check('a badge on every list row', pills.every((p) => p.text), pills.length + ' rows');
    check('the phishing mail is badged SPAM', /SPAM/.test(pills[0].text || ''), pills[0].text);
    check('the short personal note is not badged SPAM', !/SPAM/.test(pills[1].text || ''), pills[1].text);
    check('badges carry a tooltip explaining the call', /Judged by/.test(pills[0].title || ''));
    // Rows 1 and 2 are not open anywhere on the page, so they can only have been
    // judged from the subject and snippet.
    check('badges for unopened rows say they only saw the preview',
      pills.slice(0, 2).every((p) => /ml-preview/.test(p.cls || '')),
      pills.slice(0, 2).map((p) => p.cls).join(' | '));

    const card = await page.$eval('.ml-card', (node) => ({
      text: node.innerText,
      cls: node.className,
      hasBars: node.querySelectorAll('.ml-bar').length,
      hasButton: Boolean(node.querySelector('.ml-recheck')),
    }));
    process.stdout.write(`      card: ${JSON.stringify(card.text.split('\n').slice(0, 2))}\n`);

    check('the open message gets a verdict card', /Not spam|Looks like spam/.test(card.text));
    check('the card scores both spam and AI-authorship', card.hasBars === 2, card.hasBars + ' bars');
    check('the card offers a re-check', card.hasButton);
    check('the card read the whole message', /full message/.test(card.text));
    check('the marketing mail reads as AI-written', /written by AI/.test(card.text), card.text.split('\n')[0]);

    // Opening the message upgrades the row it came from.
    await page.waitForTimeout(800);
    const upgraded = await page.$eval('tr.zA:nth-child(3) .ml-pill', (n) => n.className);
    check('the matching list row upgrades to the full-message verdict', /ml-full/.test(upgraded), upgraded);

    check('nothing was sent to the Anthropic API without a key', apiCalls === 0, apiCalls + ' calls');
  } finally {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }

  if (failures.length) {
    process.stdout.write(`\n${failures.length} check(s) failed\n`);
    process.exit(1);
  }
  process.stdout.write('\nAll checks passed\n');
})();

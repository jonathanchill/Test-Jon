// Renders the business card to PNG (front, back, mockup) and a print-ready PDF.
// Usage: node build.mjs && node render.mjs
// Needs playwright (npm i -g playwright, or set PLAYWRIGHT_MODULE to its path) and a Chromium install.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'output');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 4, viewport: { width: 1000, height: 400 } });
const page = await ctx.newPage();
await page.goto('file://' + path.join(here, 'index.html'));
await page.evaluate(() => document.fonts.ready);

// Mockup sheet (both sides on the dark stage)
await page.screenshot({ path: path.join(out, 'mockup.png'), fullPage: true, scale: 'css' });

// Individual sides, no shadows / trim guides
await page.evaluate(() => document.body.classList.add('export'));
await page.locator('#front').screenshot({ path: path.join(out, 'front.png') });
await page.locator('#back').screenshot({ path: path.join(out, 'back.png') });

// Print PDF: one 91 x 61 mm page per side (85 x 55 mm trim + 3 mm bleed)
await page.emulateMedia({ media: 'print' });
await page.pdf({
  path: path.join(out, 'jonathan-hill-business-card.pdf'),
  preferCSSPageSize: true,
  printBackground: true,
});

await browser.close();
console.log('Rendered to', out);

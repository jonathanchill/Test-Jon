// Builds front.svg / back.svg for Jonathan Hill's 1minus1 business card from
// assets exported out of the 1minus1 Creds Deck (Figma), then writes index.html.
//
// Card: 85 x 55 mm trim, 3 mm bleed on every side (91 x 61 mm artwork), 5 mm safe margin.
// All coordinates below are millimetres on the 91 x 61 artwork.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const A = (f) => fs.readFileSync(path.join(here, 'assets', f), 'utf8');

// ---------------------------------------------------------------- brand tokens (from the deck's variable collection)
const C = {
  ink: '#140128',      // Color 9  – deep purple background
  lime: '#caff60',     // Color 6  – acid lime
  violet: '#9860ff',   // Color 5  – violet
  white: '#ffffff',
  grey: '#e9e7e7',     // Color 4  – pill background used on the Thank You slide
};

const W = 91, H = 61, BLEED = 3, SAFE = 5;
const L = BLEED + SAFE, T = BLEED + SAFE, R = W - BLEED - SAFE, B = H - BLEED - SAFE;

// ---------------------------------------------------------------- helpers
/** Inner markup of an exported SVG (strips the <svg> wrapper). */
function inner(svg) {
  return svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
}
/** viewBox width/height of an exported SVG. */
function box(svg) {
  const m = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/);
  return { w: +m[3], h: +m[4] };
}
/** Place an exported SVG at (x, y) scaled to a given height (mm), with a colour. */
function place(svg, x, y, h, color, extra = '') {
  const b = box(svg);
  const s = h / b.h;
  return `<g transform="translate(${x} ${y}) scale(${s})" color="${color}" ${extra}>${inner(svg)}</g>`;
}
function widthAt(svg, h) { const b = box(svg); return b.w * (h / b.h); }

/** OffBit Bold pixel glyphs → outline loops → SVG path (unit coordinates). */
const OFFBIT = JSON.parse(A('offbit-bold.json'));
function glyphPath(bitmap, ox = 0) {
  const on = new Set();
  bitmap.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'X') on.add(c + ',' + r); }));
  const has = (c, r) => on.has(c + ',' + r);
  // directed boundary edges (clockwise around filled cells)
  const edges = new Map(); // "x,y" -> [ [x2,y2], ... ]
  const add = (x1, y1, x2, y2) => { const k = x1 + ',' + y1; (edges.get(k) || edges.set(k, []).get(k)).push([x2, y2]); };
  for (const key of on) {
    const [c, r] = key.split(',').map(Number);
    if (!has(c, r - 1)) add(c, r, c + 1, r);         // top
    if (!has(c + 1, r)) add(c + 1, r, c + 1, r + 1); // right
    if (!has(c, r + 1)) add(c + 1, r + 1, c, r + 1); // bottom
    if (!has(c - 1, r)) add(c, r + 1, c, r);         // left
  }
  let d = '';
  for (const [start, outs] of edges) {
    while (outs.length) {
      let [x, y] = start.split(',').map(Number);
      const pts = [[x, y]];
      let cur = start;
      for (;;) {
        const list = edges.get(cur);
        if (!list || !list.length) break;
        const [nx, ny] = list.pop();
        if (nx + ',' + ny === start) break;
        pts.push([nx, ny]);
        cur = nx + ',' + ny;
      }
      // drop collinear points for a compact path
      const simp = pts.filter((p, i) => {
        const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
        return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
      });
      d += 'M' + simp.map(([px, py]) => `${px + ox} ${py}`).join('L') + 'Z';
    }
  }
  return d;
}
/** Set a word in OffBit Bold. Returns { d, width } in unit coordinates. */
function offbit(word) {
  let x = 0, d = '';
  for (const ch of word) {
    if (ch === ' ') { x += 6; continue; }
    const g = OFFBIT.glyphs[ch];
    if (!g) throw new Error('No OffBit glyph for ' + ch);
    d += glyphPath(g, x);
    x += g[0].length + OFFBIT.gap;
  }
  return { d, width: x - OFFBIT.gap };
}

/** "1minus1.com" cropped out of the exported "jonathan.hill@1minus1.com" text. */
function siteText() {
  const svg = A('text-email.svg');
  const d = svg.match(/ d="([^"]+)"/)[1];
  const subs = d.split(/(?=M)/).filter(s => parseFloat(s.slice(1)) >= 162);
  const x0 = 162.636;
  return `<svg viewBox="0 0 ${281 - x0} 14"><path transform="translate(${-x0} 0)" d="${subs.join('')}" fill="currentColor"/></svg>`;
}

// ---------------------------------------------------------------- shared pieces
const stairs = (fill, opacity) =>
  `<g transform="scale(${W / 1607})" fill="${fill}" fill-opacity="${opacity}">${inner(A('stairs.svg'))}</g>`;

const wordmark = (x, y, h, color) => place(A('wordmark.svg'), x, y, h, color);
const checker = (x, y, h, color) => place(A('checker.svg'), x, y, h, color);

/** Violet pixel-smiley sticker, as on the deck's title and Thank You slides. */
function smiley(cx, cy, r, rot) {
  const px = r / 6.6; // face pixel size
  const cell = (c, rr) => `<rect x="${(c - 4.5) * px}" y="${(rr - 3.5) * px}" width="${px}" height="${px}"/>`;
  const eyes = cell(2, 1) + cell(6, 1);
  const mouth = cell(1, 4) + cell(2, 5) + cell(3, 6) + cell(4, 6) + cell(5, 6) + cell(6, 5) + cell(7, 4);
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})">
    <circle r="${r}" fill="${C.violet}"/>
    <circle r="${r * 0.86}" fill="none" stroke="${C.ink}" stroke-width="${r * 0.04}"/>
    <g fill="${C.ink}" transform="translate(0 ${-px * 0.6})">${eyes}${mouth}</g>
  </g>`;
}

/** White oval "1minus1" sticker from the deck's title slide. */
function ovalSticker(cx, cy, rx, ry, rot) {
  const h = ry * 0.55;
  const w = widthAt(A('wordmark.svg'), h);
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})">
    <ellipse rx="${rx}" ry="${ry}" fill="${C.white}"/>
    <ellipse rx="${rx * 0.9}" ry="${ry * 0.86}" fill="none" stroke="${C.ink}" stroke-width="${ry * 0.05}"/>
    ${wordmark(-w / 2, -h / 2, h, C.ink)}
  </g>`;
}

/** Rounded contact pill with mixed content [{svg,h?} | {checker:true}] laid out left→right. */
function pill(x, y, items, { bg = C.white, fg = C.ink, textH = 2.3, padX = 2, gap = 1.6, h = 5.4, radius = 1.3 } = {}) {
  let cx = x + padX, body = '';
  for (const it of items) {
    if (it.checker) {
      const ch = 1.35, cw = ch * 2;
      body += checker(cx, y + (h - ch) / 2, ch, fg);
      cx += cw + gap;
    } else {
      const th = it.h || textH, tw = widthAt(it.svg, th);
      body += place(it.svg, cx, y + (h - th) / 2 + (it.dy || 0), th, fg);
      cx += tw + gap;
    }
  }
  const w = cx - gap + padX - x;
  return { markup: `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${bg}"/>${body}`, w };
}

const svgOpen = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">`;

// ================================================================ FRONT
function front() {
  const name1 = offbit('JONATHAN');
  const u1 = (R - L) / name1.width;               // fill the safe width
  const name2 = offbit('HILL');
  const u2 = 1.02;
  const x2 = R - name2.width * u2;                 // right-aligned, like "THIS IS 1MINUS1"
  const site = siteText();

  return `${svgOpen}
  <rect width="${W}" height="${H}" fill="${C.ink}"/>
  ${stairs(C.white, 0.08)}
  ${wordmark(L, T, 3.6, C.white)}
  ${checker(R - 3.2, T + 0.9, 1.6, C.violet)}

  <!-- JONATHAN — OffBit Bold, solid lime -->
  <path transform="translate(${L} 15.6) scale(${u1})" d="${name1.d}" fill="${C.lime}" fill-rule="evenodd"/>
  <!-- HILL — OffBit Bold, outlined (the deck's 'THIS IS 1MINUS1' treatment) -->
  <path transform="translate(${x2} 28.6) scale(${u2})" d="${name2.d}" fill="none" stroke="${C.lime}" stroke-width="${0.56 / u2}" stroke-linejoin="miter"/>

  ${smiley(23.5, 36.4, 7.6, -16)}

  <!-- caption row: checker + FOUNDER AND CEO (Neue Power Bold) -->
  ${checker(L, B - 2.0, 1.4, C.violet)}
  ${place(A('text-founder-and-ceo.svg'), L + 4.2, B - 2.35, 2.1, C.white)}
  <!-- 1minus1.com -->
  ${place(site, R - widthAt(site, 2.1), B - 2.35, 2.1, C.lime)}
</svg>`;
}

// ================================================================ BACK
function back() {
  const site = siteText();
  const rows = [];
  let y = 22.4;
  const r1 = pill(L, y, [{ checker: true }, { svg: A('text-jonathan-hill.svg'), h: 2.3 }, { checker: true }, { svg: A('text-founder.svg') }, { checker: true }, { svg: A('text-ceo.svg') }]);
  rows.push(r1.markup); y += 5.4 + 1.9;
  const r2 = pill(L, y, [{ svg: A('text-email.svg') }]);
  rows.push(r2.markup); y += 5.4 + 1.9;
  const r3 = pill(L, y, [{ svg: A('text-phone.svg'), h: 2.65, dy: 0.05 }]);
  rows.push(r3.markup); y += 5.4 + 1.9;
  const r4 = pill(L, y, [{ svg: site }], { bg: C.violet, fg: C.white });
  rows.push(r4.markup);

  return `${svgOpen}
  <rect width="${W}" height="${H}" fill="${C.lime}"/>
  ${stairs(C.white, 0.26)}
  ${wordmark(L, T, 3.6, C.ink)}
  ${checker(R - 3.2, T + 0.9, 1.6, C.ink)}

  <!-- GET IN TOUCH (Neue Power Bold) -->
  ${place(A('text-get-in-touch.svg'), L, 16.3, 3.3, C.ink)}

  ${rows.join('\n  ')}

  <!-- bits sticker (pixel smileys) — recoloured to the deck's dark card -->
  <g transform="translate(52.5 15.2) rotate(-4)">${place(A('bits-sticker.svg').replace('#CAFF60', C.ink), 0, 0, 5.9, C.ink)}</g>

  ${ovalSticker(70.5, 44.2, 13.5, 7.6, -14)}
</svg>`;
}

// ================================================================ write files
const out = path.join(here, 'output');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(here, 'front.svg'), front());
fs.writeFileSync(path.join(here, 'back.svg'), back());

fs.writeFileSync(path.join(here, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Jonathan Hill — 1minus1 business card</title>
<style>
  :root { --ink:${C.ink}; --lime:${C.lime}; --violet:${C.violet}; }
  html, body { margin:0; }
  body { background:#0b0418; color:#fff; font: 500 13px/1.4 system-ui, sans-serif; }
  .stage { min-height:100vh; box-sizing:border-box; display:flex; flex-wrap:wrap; gap:14mm; padding:14mm; align-items:flex-start; justify-content:center;
           background: radial-gradient(circle at 15% 10%, #26124a 0, transparent 45%), radial-gradient(circle at 90% 90%, #1a0b36 0, transparent 40%), #0b0418; }
  .side { display:flex; flex-direction:column; gap:3mm; align-items:center; }
  .side .label { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--violet); }
  .card { position:relative; width:91mm; height:61mm; box-shadow:0 18px 40px rgba(0,0,0,.6); border-radius:1mm; overflow:hidden; }
  .card svg { display:block; width:91mm; height:61mm; }
  .card::after { content:""; position:absolute; inset:3mm; border:.15mm dashed rgba(255,255,255,.28); pointer-events:none; }
  body.export .card { box-shadow:none; border-radius:0; }
  body.export .card::after { display:none; }
  @media print {
    @page { size: 91mm 61mm; margin:0; }
    body { background:none; }
    .stage { display:block; padding:0; min-height:0; background:none; }
    .side { display:block; } .label { display:none; }
    .card { box-shadow:none; border-radius:0; break-after:page; }
    .card::after { display:none; }
  }
</style>
</head>
<body>
<div class="stage">
  <div class="side"><div class="label">Front</div><div class="card" id="front">${front()}</div></div>
  <div class="side"><div class="label">Back</div><div class="card" id="back">${back()}</div></div>
</div>
</body>
</html>
`);
console.log('wrote front.svg, back.svg, index.html');

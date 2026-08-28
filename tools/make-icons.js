/*
 * Generates the extension icons: a magnifier over an envelope, in the same
 * purple the AI badge uses. Run with `node tools/make-icons.js` after editing.
 * Written by hand so the repo needs no image toolchain to rebuild them.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // no per-row filter
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const PURPLE = [132, 48, 206];
const WHITE = [255, 255, 255];

/** Signed distance helpers, all in 0..1 unit space so every size renders the same. */
function draw(x, y, size) {
  const u = (x + 0.5) / size;
  const v = (y + 0.5) / size;
  const aa = 1.5 / size; // one-and-a-half pixels of feathering

  // Rounded-square background.
  const dx = Math.max(Math.abs(u - 0.5) - 0.5 + 0.22, 0);
  const dy = Math.max(Math.abs(v - 0.5) - 0.5 + 0.22, 0);
  const square = Math.hypot(dx, dy) - 0.22;
  const bg = 1 - smooth(square, aa);
  if (bg <= 0) return [0, 0, 0, 0];

  let r = PURPLE[0], g = PURPLE[1], b = PURPLE[2];

  // Envelope body.
  const inBody = u > 0.2 && u < 0.8 && v > 0.3 && v < 0.68;
  const border = 0.035;
  const onBodyEdge = inBody && (u < 0.2 + border || u > 0.8 - border || v < 0.3 + border || v > 0.68 - border);
  // The flap: two diagonals meeting in the middle of the envelope.
  const flapLeft = Math.abs((v - 0.3) - (u - 0.2) * 0.63) < border * 0.9 && u >= 0.2 && u <= 0.5;
  const flapRight = Math.abs((v - 0.3) - (0.8 - u) * 0.63) < border * 0.9 && u > 0.5 && u <= 0.8;

  if (onBodyEdge || flapLeft || flapRight) [r, g, b] = WHITE;

  // Magnifier: ring plus handle, sitting over the lower right of the envelope.
  const ring = Math.abs(Math.hypot(u - 0.64, v - 0.63) - 0.17) - 0.035;
  const alongHandle = (u - 0.76) * 0.707 + (v - 0.75) * 0.707;
  const acrossHandle = Math.abs(-(u - 0.76) * 0.707 + (v - 0.75) * 0.707) - 0.032;
  const onHandle = alongHandle > 0 && alongHandle < 0.16 && acrossHandle < 0;
  if (ring < 0 || onHandle) [r, g, b] = WHITE;
  // Punch the lens clear so the envelope reads through it.
  if (Math.hypot(u - 0.64, v - 0.63) < 0.135) [r, g, b] = PURPLE;

  return [r, g, b, Math.round(255 * bg)];
}

function smooth(distance, width) {
  return Math.min(1, Math.max(0, distance / width + 0.5));
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png(size, draw));
  process.stdout.write(`icons/icon${size}.png\n`);
}

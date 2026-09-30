// Validates every file in content/units against content/schema.json and a
// few cross-file rules. Exits non-zero on the first problem set so CI fails.
//
//   node scripts/validate-content.mjs
//
// Also imported by tests/content.test.ts.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = join(root, 'content', 'schema.json');
const unitsDir = join(root, 'content', 'units');

const TYPES_NEEDING_TRANSLATION_ANSWERS = new Set(['translate', 'transform', 'errorspot', 'dictation']);

export function validateAll() {
  const errors = [];
  const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const validate = ajv.compile(schema);

  const files = readdirSync(unitsDir).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) errors.push('content/units contains no .json files');

  const seenIds = new Map(); // item id -> file
  const seenOrders = new Map();
  const units = [];

  for (const file of files) {
    const path = join(unitsDir, file);
    let data;
    try {
      data = JSON.parse(readFileSync(path, 'utf8'));
    } catch (e) {
      errors.push(`${file}: invalid JSON (${e.message})`);
      continue;
    }
    if (!validate(data)) {
      for (const err of validate.errors ?? []) {
        errors.push(`${file}${err.instancePath || '/'}: ${err.message}${err.params?.allowedValues ? ' (' + err.params.allowedValues.join(', ') + ')' : ''}`);
      }
      continue;
    }
    units.push(data);
    const expectedId = basename(file, '.json');
    if (data.id !== expectedId) errors.push(`${file}: unit id "${data.id}" must match the file name "${expectedId}"`);
    if (seenOrders.has(data.order)) errors.push(`${file}: order ${data.order} already used by ${seenOrders.get(data.order)}`);
    seenOrders.set(data.order, file);

    const seenFrByType = new Map();
    for (const item of data.items) {
      const where = `${file} item ${item.id}`;
      if (seenIds.has(item.id)) errors.push(`${where}: duplicate id (also in ${seenIds.get(item.id)})`);
      seenIds.set(item.id, file);
      if (item.unit !== data.id) errors.push(`${where}: unit "${item.unit}" does not match file unit "${data.id}"`);
      const frKey = `${item.type}::${item.fr.trim().toLowerCase()}`;
      if (seenFrByType.has(frKey)) errors.push(`${where}: duplicate ${item.type} for "${item.fr}" (also ${seenFrByType.get(frKey)})`);
      seenFrByType.set(frKey, item.id);
      if (!item.en.trim()) errors.push(`${where}: missing English translation`);
      if (item.type === 'choice' && !item.answers.some((a) => item.choices.includes(a))) {
        errors.push(`${where}: none of the answers appears in choices`);
      }
      if (item.type === 'gapfill') {
        const blanks = (item.prompt_fr.match(/___/g) ?? []).length;
        if (blanks !== 1) errors.push(`${where}: gapfill prompt must contain exactly one ___`);
        const filled = item.prompt_fr.replace('___', item.answers[0]).replace(/'\s+/g, "'").replace(/\s+/g, ' ').trim();
        if (filled.toLowerCase() !== item.fr.replace(/\s+/g, ' ').trim().toLowerCase()) {
          errors.push(`${where}: prompt_fr with the first answer filled in ("${filled}") does not equal fr ("${item.fr}")`);
        }
      }
      if (TYPES_NEEDING_TRANSLATION_ANSWERS.has(item.type) && !item.answers.some((a) => a.trim().toLowerCase() === item.fr.trim().toLowerCase())) {
        errors.push(`${where}: fr must be one of the accepted answers`);
      }
      if (item.lesson_date && item.source !== 'lesson') {
        errors.push(`${where}: lesson_date is set but source is "${item.source}"`);
      }
    }
  }

  return { errors, units, files };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const { errors, units } = validateAll();
  if (errors.length) {
    console.error(`Content validation failed with ${errors.length} problem(s):\n`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  const total = units.reduce((n, u) => n + u.items.length, 0);
  console.log(`Content OK: ${units.length} unit(s), ${total} item(s).`);
  for (const u of units) console.log(`  ${u.id.padEnd(22)} P${u.priority}  ${String(u.items.length).padStart(3)} items`);
}

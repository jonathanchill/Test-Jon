import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without types
import { validateAll } from '../scripts/validate-content.mjs';

describe('content', () => {
  const { errors, units } = validateAll() as { errors: string[]; units: { id: string; items: unknown[] }[] };

  it('validates against the schema and cross-file rules', () => {
    expect(errors).toEqual([]);
  });

  it('has at least one unit with at least 20 items each', () => {
    expect(units.length).toBeGreaterThan(0);
    for (const u of units) expect(u.items.length, u.id).toBeGreaterThanOrEqual(20);
  });
});

import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { summary } from '../src/commands/summary';
import type { Output } from '../src/output';

function createTestOutput() {
  const lines: string[] = [];
  const errors: string[] = [];
  return {
    output: {
      log: (text: string) => lines.push(text),
      error: (text: string) => errors.push(text),
    } satisfies Output,
    lines,
    errors,
  };
}

const fixture = (name: string) => resolve(process.cwd(), '..', 'core', 'tests', 'fixtures', name);

describe('summary command', () => {
  it('prints tour summary for valid file', async () => {
    const { output, lines } = createTestOutput();
    const code = await summary(fixture('sample.tourguide'), output);
    expect(code).toBe(0);
    const text = lines.join('\n');
    expect(text).toContain('Sample tour');
    expect(text).toContain('diff');
    expect(text).toContain('Routing');
    expect(text).toContain('1 step');
    expect(text).toContain('Helper');
    expect(text).toContain('src/entry.ts');
    expect(text).toContain('primary');
  });

  it('reports error for invalid file', async () => {
    const { output, errors } = createTestOutput();
    const code = await summary(fixture('invalid.tourguide'), output);
    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('✗');
  });

  it('reports error for nonexistent file', async () => {
    const { output, errors } = createTestOutput();
    const code = await summary('/nonexistent.tourguide', output);
    expect(code).toBe(1);
    expect(errors.length).toBeGreaterThan(0);
  });
});

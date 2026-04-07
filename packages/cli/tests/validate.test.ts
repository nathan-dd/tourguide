import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validate } from '../src/commands/validate';
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

describe('validate command', () => {
  it('reports valid file with tour info', async () => {
    const { output, lines } = createTestOutput();
    const code = await validate([fixture('minimal.tourguide')], output);
    expect(code).toBe(0);
    expect(lines.join('\n')).toContain('Minimal tour');
    expect(lines.join('\n')).toContain('✓');
  });

  it('reports invalid file with errors', async () => {
    const { output, errors } = createTestOutput();
    const code = await validate([fixture('invalid.tourguide')], output);
    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('✗');
    expect(errors.join('\n')).toContain('Unknown chapter reference');
  });

  it('reports file-not-found', async () => {
    const { output, errors } = createTestOutput();
    const code = await validate(['/nonexistent/file.tourguide'], output);
    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('✗');
  });

  it('validates multiple files — exits 1 if any fail', async () => {
    const { output, lines, errors } = createTestOutput();
    const code = await validate(
      [fixture('minimal.tourguide'), fixture('invalid.tourguide')],
      output,
    );
    expect(code).toBe(1);
    expect(lines.join('\n')).toContain('✓');
    expect(errors.join('\n')).toContain('✗');
  });
});

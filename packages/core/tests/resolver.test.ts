import { describe, expect, it } from 'vitest';
import { resolveByPattern, resolveByRange, resolveStep } from '../src/resolver';

const fileContent =
  'function main() {\n  return helper();\n}\n\nfunction helper() {\n  return 42;\n}\n';

describe('resolver', () => {
  it('resolves by explicit range', () => {
    const resolved = resolveByRange(
      {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 15 },
      },
      fileContent,
    );
    expect(resolved?.method).toBe('range');
    expect(resolved?.text).toBe('function main()');
  });

  it('resolves by regex pattern', () => {
    const resolved = resolveByPattern('function helper\\(\\)', fileContent);
    expect(resolved?.method).toBe('pattern');
    expect(resolved?.text).toBe('function helper()');
    expect(resolved?.range.start.line).toBe(5);
  });

  it('returns null for out-of-bounds range', () => {
    const resolved = resolveByRange(
      {
        start: { line: 100, character: 0 },
        end: { line: 100, character: 1 },
      },
      fileContent,
    );
    expect(resolved).toBeNull();
  });

  it('returns null for invalid regex', () => {
    const resolved = resolveByPattern('([invalid', fileContent);
    expect(resolved).toBeNull();
  });

  it('falls back from stale range to pattern', () => {
    const resolved = resolveStep(
      {
        id: 'step-1',
        file: 'src/a.ts',
        range: {
          start: { line: 100, character: 0 },
          end: { line: 100, character: 1 },
        },
        pattern: 'function helper\\(\\)',
        title: 'helper',
        description: 'helper',
        kind: 'utility',
        chapter: 'ch-1',
        connections: [],
        annotationRefs: [],
      },
      fileContent,
    );
    expect(resolved?.method).toBe('pattern');
  });

  it('returns null when both range and pattern fail', () => {
    const resolved = resolveStep(
      {
        id: 'step-1',
        file: 'src/a.ts',
        range: {
          start: { line: 100, character: 0 },
          end: { line: 100, character: 1 },
        },
        pattern: 'doesNotExist',
        title: 'missing',
        description: 'missing',
        kind: 'utility',
        chapter: 'ch-1',
        connections: [],
        annotationRefs: [],
      },
      fileContent,
    );
    expect(resolved).toBeNull();
  });
});

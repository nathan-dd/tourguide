import type { Chapter, Step } from '@tourguide/format';
import { describe, expect, it } from 'vitest';
import { renderTourComplete, renderTourHeader, renderTourStep } from '../src/commands/play';
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

describe('play rendering', () => {
  it('renderTourHeader shows title and instructions', () => {
    const { output, lines } = createTestOutput();
    renderTourHeader({ title: 'My Tour', description: 'A great tour' }, output);
    const text = lines.join('\n');
    expect(text).toContain('My Tour');
    expect(text).toContain('A great tour');
    expect(text).toContain('Enter');
    expect(text).toContain('q');
  });

  it('renderTourComplete shows step count', () => {
    const { output, lines } = createTestOutput();
    renderTourComplete(12, output);
    const text = lines.join('\n');
    expect(text).toContain('Tour complete');
    expect(text).toContain('12');
  });

  it('renderTourStep shows step with separator', () => {
    const { output, lines } = createTestOutput();
    const progress = {
      chapter: { current: 1, total: 2 },
      chapterStep: { current: 1, total: 3 },
      overallStep: { current: 1, total: 6 },
    };
    const chapter: Chapter = { id: 'ch', title: 'Ch', summary: 'S', steps: [] };
    const step: Step = {
      id: 's',
      file: 'a.ts',
      range: { start: { line: 1, character: 0 }, end: { line: 3, character: 0 } },
      title: 'My Step',
      description: 'Step description',
      kind: 'utility',
      chapter: 'ch',
      connections: [],
      annotationRefs: [],
    };
    renderTourStep(progress, chapter, step, null, false, output);
    const text = lines.join('\n');
    expect(text).toContain('My Step');
    expect(text).toContain('Step description');
    expect(text).toContain('a.ts');
    expect(text).toContain('─');
  });

  it('renderTourStep shows chapter transition when chapter changes', () => {
    const { output, lines } = createTestOutput();
    const progress = {
      chapter: { current: 2, total: 3 },
      chapterStep: { current: 1, total: 2 },
      overallStep: { current: 4, total: 10 },
    };
    const chapter: Chapter = {
      id: 'ch-2',
      title: 'New Chapter',
      summary: 'New things',
      steps: [],
    };
    const step: Step = {
      id: 's',
      file: 'b.ts',
      range: { start: { line: 5, character: 0 }, end: { line: 10, character: 0 } },
      title: 'First in chapter',
      description: 'D',
      kind: 'utility',
      chapter: 'ch-2',
      connections: [],
      annotationRefs: [],
    };
    renderTourStep(progress, chapter, step, null, true, output);
    const text = lines.join('\n');
    expect(text).toContain('━');
    expect(text).toContain('New Chapter');
  });
});

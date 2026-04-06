import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGraph } from '../src/graph';
import { loadTour } from '../src/loader';
import { resolveStep } from '../src/resolver';
import { firstPosition, getStep, nextStep } from '../src/traversal';

describe('integration', () => {
  it('loads example tour and traverses all steps', async () => {
    const tour = await loadTour(resolve(process.cwd(), '../../examples/sample.tourguide'));
    const start = firstPosition(tour);
    const first = getStep(tour, start);
    const secondPosition = nextStep(tour, start);

    expect(first.id).toBe('step-format-schema');
    expect(secondPosition).not.toBeNull();
    if (secondPosition) {
      const second = getStep(tour, secondPosition);
      expect(second.id).toBe('step-format-validate');
    }
  });

  it('navigates graph relationships from the example tour', async () => {
    const tour = await loadTour(resolve(process.cwd(), '../../examples/sample.tourguide'));
    const graph = buildGraph(tour);
    const related = graph.related('step-format-schema');

    expect(related.map((item) => item.node.id)).toContain('step-format-validate');
  });

  it('resolves ranges and pattern fallbacks from tour steps', async () => {
    const tour = await loadTour(resolve(process.cwd(), '../../examples/sample.tourguide'));
    const fileContent = readFileSync(resolve(process.cwd(), '../format/src/schema.ts'), 'utf8');
    const rangeStep = tour.chapters[0].steps[0];
    const patternStep = tour.chapters[0].steps[1];

    const byRange = resolveStep(rangeStep, fileContent);
    const byPattern = resolveStep(
      {
        ...patternStep,
        range: {
          start: { line: 9999, character: 0 },
          end: { line: 9999, character: 1 },
        },
      },
      fileContent,
    );

    expect(byRange).not.toBeNull();
    expect(byPattern?.method).toBe('pattern');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGraph, resolveNode } from '../src/graph';
import { parseTour } from '../src/loader';

const sampleTour = parseTour(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/sample.tourguide'), 'utf8'),
);

describe('graph', () => {
  it('resolves step and annotation nodes', () => {
    const step = resolveNode(sampleTour, 'step-1');
    const annotation = resolveNode(sampleTour, 'ann-1');
    expect(step?.id).toBe('step-1');
    expect(annotation?.id).toBe('ann-1');
    expect(resolveNode(sampleTour, 'missing')).toBeUndefined();
  });

  it('returns outgoing and incoming connections', () => {
    const graph = buildGraph(sampleTour);
    expect(graph.outgoing('step-1')).toHaveLength(1);
    expect(graph.incoming('step-2')).toHaveLength(1);
  });

  it('returns related nodes with edge metadata', () => {
    const graph = buildGraph(sampleTour);
    const related = graph.related('step-1');
    expect(related).toHaveLength(1);
    expect(related[0].node.id).toBe('step-2');
    expect(related[0].connection.type).toBe('calls');
  });

  it('filters related nodes by connection type', () => {
    const graph = buildGraph(sampleTour);
    const calls = graph.byType('step-1', 'calls');
    const imports = graph.byType('step-1', 'imports');
    expect(calls.map((item) => item.id)).toEqual(['step-2']);
    expect(imports).toEqual([]);
  });

  it('handles nodes without connections', () => {
    const graph = buildGraph(sampleTour);
    expect(graph.outgoing('ann-1')).toEqual([]);
    expect(graph.incoming('step-1')).toEqual([]);
  });
});

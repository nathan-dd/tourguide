import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tour } from '@tourguide/format';
import { describe, expect, it } from 'vitest';
import { buildGraph, resolveNode } from '../src/graph';
import { parseTour } from '../src/loader';

function makeTourWithPerStepConnections(): Tour {
  return {
    version: '1.0.0',
    title: 'Per-step connections',
    description: 'Test',
    mode: 'codebase',
    ref: 'main',
    overview: { summary: 'Test', fileMap: [] },
    chapters: [
      {
        id: 'ch-1',
        title: 'Ch 1',
        summary: 'S',
        steps: [
          {
            id: 's-1',
            file: 'a.ts',
            range: { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } },
            title: 'S1',
            description: 'D',
            kind: 'utility',
            chapter: 'ch-1',
            connections: [{ from: 's-1', to: 's-2', type: 'calls' }],
            annotationRefs: [],
          },
          {
            id: 's-2',
            file: 'b.ts',
            range: { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } },
            title: 'S2',
            description: 'D',
            kind: 'utility',
            chapter: 'ch-1',
            connections: [],
            annotationRefs: [],
          },
        ],
      },
    ],
    annotations: [],
    connections: [],
  } as Tour;
}

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

describe('buildGraph — per-step connections', () => {
  it('indexes connections defined only on steps', () => {
    const tour = makeTourWithPerStepConnections();
    const graph = buildGraph(tour);
    expect(graph.outgoing('s-1')).toHaveLength(1);
    expect(graph.outgoing('s-1')[0].type).toBe('calls');
    expect(graph.incoming('s-2')).toHaveLength(1);
  });

  it('deduplicates overlapping top-level and per-step connections', () => {
    const graph = buildGraph(sampleTour);
    // sampleTour has step-1→step-2 (calls) both per-step and top-level
    const outgoing = graph.outgoing('step-1');
    const callsToStep2 = outgoing.filter((c) => c.to === 'step-2' && c.type === 'calls');
    expect(callsToStep2).toHaveLength(1);
  });

  it('resolves related nodes from per-step connections', () => {
    const tour = makeTourWithPerStepConnections();
    const graph = buildGraph(tour);
    const related = graph.related('s-1');
    expect(related).toHaveLength(1);
    expect(related[0].node.id).toBe('s-2');
  });
});

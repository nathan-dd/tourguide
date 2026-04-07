import { describe, expect, it } from 'vitest';
import { buildDiscoveryPrompt, buildNarrationPrompt } from '../src/prompts';

describe('buildDiscoveryPrompt', () => {
  it('keeps the system prompt free of tour output hints', () => {
    const diff = 'diff --git a/x b/x\n';
    const { system, prompt } = buildDiscoveryPrompt(diff);

    expect(system.toLowerCase()).not.toContain('tourguide');
    expect(system.toLowerCase()).not.toContain('schema');
    expect(system).not.toMatch(/JSON/i);

    expect(prompt).toContain(diff);
  });
});

describe('buildNarrationPrompt', () => {
  it('includes synthesis, diff, refs, and a reviewer-focused system prompt', () => {
    const synthesis = 'The change adds caching to the API layer.';
    const diff = '@@ -1,1 +1,2 @@\n+foo\n';
    const baseRef = 'main';
    const headRef = 'feature/cache';

    const { system, prompt } = buildNarrationPrompt({ synthesis, diff, baseRef, headRef });

    expect(system.toLowerCase()).toContain('reviewer');
    expect(prompt).toContain(synthesis);
    expect(prompt).toContain(diff);
    expect(prompt).toContain(baseRef);
    expect(prompt).toContain(headRef);
    expect(prompt.toLowerCase()).toContain('diff');
  });

  it('appends promptAppend when provided', () => {
    const { prompt } = buildNarrationPrompt({
      synthesis: 's',
      diff: 'd',
      baseRef: 'a',
      headRef: 'b',
      promptAppend: 'Retry hint',
    });
    expect(prompt.endsWith('Retry hint')).toBe(true);
  });
});

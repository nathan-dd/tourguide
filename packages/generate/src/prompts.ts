/**
 * Prompt builders for the two-call discovery → narration pipeline.
 */

export function buildDiscoveryPrompt(diff: string): { system: string; prompt: string } {
  const system = [
    'You are a senior engineer reviewing a pull request.',
    'Your job is to understand what changed, why it changed, how the pieces relate, and what a reviewer should pay attention to.',
    'Use the tools you are given to explore the repository and follow threads until you are satisfied you have a solid mental model.',
    'When you are done exploring, write a clear synthesis of your findings in plain prose.',
  ].join(' ');

  const prompt = [
    'Below is the patch for this change (unified diff). Use it as the starting point for your investigation.',
    '',
    diff,
  ].join('\n');

  return { system, prompt };
}

export function buildNarrationPrompt(options: {
  synthesis: string;
  diff: string;
  baseRef: string;
  headRef: string;
}): { system: string; prompt: string } {
  const { synthesis, diff, baseRef, headRef } = options;

  const system = [
    'You are writing a guided tour of a pull request for a code reviewer who needs to understand the change quickly.',
    'Organize the material into an engaging walkthrough.',
    'Explain motivation and reasoning — the why — not only a list of edits.',
    'Group steps by conceptual theme rather than by file order.',
    'Skip boilerplate and obvious mechanical changes unless they matter for understanding.',
    'The final output must match the structured format required by the caller (machine-readable).',
  ].join(' ');

  const prompt = [
    'You are producing a diff-mode tour anchored to the patch between git refs.',
    `baseRef: ${baseRef}`,
    `headRef: ${headRef}`,
    '',
    'Discovery synthesis (from an earlier analysis pass):',
    '',
    synthesis,
    '',
    'Raw unified diff (use paths and line numbers here when anchoring steps):',
    '',
    diff,
  ].join('\n');

  return { system, prompt };
}

import type { Annotation, Range, Step } from '@tourguide/format';

export type ResolvedRange = {
  range: Range;
  text: string;
  method: 'range' | 'pattern';
};

type Resolvable = Pick<Step, 'range' | 'pattern'> | Pick<Annotation, 'range' | 'pattern'>;

function lineStartOffsets(fileContent: string): number[] {
  const starts = [0];
  for (let index = 0; index < fileContent.length; index += 1) {
    if (fileContent[index] === '\n') {
      starts.push(index + 1);
    }
  }
  return starts;
}

function toOffset(fileContent: string, line: number, character: number): number | null {
  const starts = lineStartOffsets(fileContent);
  const lineIndex = line - 1;
  if (lineIndex < 0 || lineIndex >= starts.length) {
    return null;
  }
  const lineStart = starts[lineIndex];
  const lineEnd = lineIndex + 1 < starts.length ? starts[lineIndex + 1] - 1 : fileContent.length;
  const offset = lineStart + character;
  if (offset < lineStart || offset > lineEnd) {
    return null;
  }
  return offset;
}

function toPosition(fileContent: string, offset: number): { line: number; character: number } {
  const starts = lineStartOffsets(fileContent);
  let line = 0;
  for (let index = 0; index < starts.length; index += 1) {
    if (starts[index] > offset) {
      break;
    }
    line = index;
  }
  return {
    line: line + 1,
    character: offset - starts[line],
  };
}

export function resolveByRange(range: Range, fileContent: string): ResolvedRange | null {
  const startOffset = toOffset(fileContent, range.start.line, range.start.character);
  const endOffset = toOffset(fileContent, range.end.line, range.end.character);
  if (startOffset === null || endOffset === null || endOffset < startOffset) {
    return null;
  }

  const text = fileContent.slice(startOffset, endOffset);
  return {
    range,
    text,
    method: 'range',
  };
}

export function resolveByPattern(pattern: string, fileContent: string): ResolvedRange | null {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, 'm');
  } catch {
    return null;
  }

  const match = regex.exec(fileContent);
  if (!match || match.index === undefined) {
    return null;
  }

  const startOffset = match.index;
  const endOffset = startOffset + match[0].length;
  return {
    range: {
      start: toPosition(fileContent, startOffset),
      end: toPosition(fileContent, endOffset),
    },
    text: match[0],
    method: 'pattern',
  };
}

export function resolveStep(step: Resolvable, fileContent: string): ResolvedRange | null {
  const byRange = resolveByRange(step.range, fileContent);
  if (byRange) {
    return byRange;
  }

  if (step.pattern) {
    return resolveByPattern(step.pattern, fileContent);
  }

  return null;
}
